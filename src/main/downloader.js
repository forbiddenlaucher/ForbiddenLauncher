const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

class Downloader {
  constructor() {
    this.activeDownloads = 0;
    this.maxConcurrent = 6;
  }

  /**
   * Calculates SHA-256 hash of a local file
   */
  async getFileHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return resolve(null);
      }
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Downloads a single file with redirect support and progress callbacks
   */
  downloadFile(url, destPath, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        expectedHash = null,
        hashAlgorithm = 'sha256',
        onProgress = () => {},
        maxRedirects = 5,
        timeout = 30000
      } = options;

      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const tempPath = `${destPath}.tmp_${Date.now()}`;

      const attemptDownload = (currentUrl, redirectsLeft) => {
        if (redirectsLeft <= 0) {
          return reject(new Error(`Too many redirects for URL: ${url}`));
        }

        let parsedUrl;
        try {
          parsedUrl = new URL(currentUrl);
        } catch (e) {
          return reject(new Error(`Invalid URL: ${currentUrl}`));
        }

        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.get(parsedUrl, { timeout }, (res) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, parsedUrl).href;
            res.resume(); // Consume response data to free up memory
            return attemptDownload(redirectUrl, redirectsLeft - 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP status ${res.statusCode} while downloading ${currentUrl}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;
          let lastTime = Date.now();
          let bytesSinceLast = 0;
          let currentSpeed = 0;

          const fileStream = fs.createWriteStream(tempPath);
          const hashStream = expectedHash ? crypto.createHash(hashAlgorithm) : null;

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            bytesSinceLast += chunk.length;
            if (hashStream) {
              hashStream.update(chunk);
            }

            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.25) { // update speed 4x per second
              currentSpeed = bytesSinceLast / elapsed;
              lastTime = now;
              bytesSinceLast = 0;

              onProgress({
                receivedBytes,
                totalBytes,
                percentage: totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0,
                speedBytesPerSec: currentSpeed
              });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(async () => {
              if (expectedHash && hashStream) {
                const calculatedHash = hashStream.digest('hex').toLowerCase();
                if (calculatedHash !== expectedHash.toLowerCase()) {
                  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                  return reject(new Error(`Hash mismatch for ${destPath}. Expected: ${expectedHash}, got: ${calculatedHash}`));
                }
              }

              try {
                if (fs.existsSync(destPath)) {
                  fs.unlinkSync(destPath);
                }
                fs.renameSync(tempPath, destPath);
                resolve({ path: destPath, totalBytes: receivedBytes });
              } catch (renameErr) {
                reject(renameErr);
              }
            });
          });

          fileStream.on('error', (err) => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            reject(err);
          });
        });

        req.on('timeout', () => {
          req.destroy();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(new Error(`Connection timed out downloading ${url}`));
        });

        req.on('error', (err) => {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(err);
        });
      };

      attemptDownload(url, maxRedirects);
    });
  }

  /**
   * Downloads multiple files with pool concurrency and real-time aggregate progress reporting
   */
  async downloadBatch(items, onOverallProgress = () => {}) {
    const totalItems = items.length;
    let completedItems = 0;
    let totalBytesSum = items.reduce((acc, item) => acc + (item.size || 0), 0);
    let downloadedBytesSum = 0;
    let activeWorkers = 0;
    let itemIndex = 0;
    let errors = [];

    let batchStartTime = Date.now();
    let lastProgressTime = 0;

    return new Promise((resolve, reject) => {
      if (totalItems === 0) {
        onOverallProgress({
          completedItems: 0,
          totalItems: 0,
          percentage: 100,
          currentFile: '',
          downloadedBytes: 0,
          totalBytes: 0,
          speedBytesPerSec: 0
        });
        return resolve();
      }

      const reportProgress = (currentFileName = '', currentSpeed = 0) => {
        const percent = totalBytesSum > 0 
          ? (downloadedBytesSum / totalBytesSum) * 100 
          : (completedItems / totalItems) * 100;

        const elapsedBatch = (Date.now() - batchStartTime) / 1000;
        const avgSpeed = elapsedBatch > 0 ? (downloadedBytesSum / elapsedBatch) : 0;

        onOverallProgress({
          completedItems,
          totalItems,
          percentage: Math.min(100, Math.max(0, percent)),
          currentFile: currentFileName,
          downloadedBytes: downloadedBytesSum,
          totalBytes: totalBytesSum,
          speedBytesPerSec: currentSpeed || avgSpeed
        });
      };

      const next = () => {
        if (errors.length > 0) {
          return reject(errors[0]);
        }

        if (completedItems >= totalItems) {
          reportProgress('', 0);
          return resolve();
        }

        while (activeWorkers < this.maxConcurrent && itemIndex < totalItems) {
          const currentItem = items[itemIndex++];
          activeWorkers++;

          let itemReceivedBytes = 0;

          this.downloadFile(currentItem.url, currentItem.dest, {
            expectedHash: currentItem.hash,
            hashAlgorithm: currentItem.hashAlgorithm || 'sha256',
            onProgress: (prog) => {
              const delta = prog.receivedBytes - itemReceivedBytes;
              if (delta > 0) {
                itemReceivedBytes = prog.receivedBytes;
                downloadedBytesSum += delta;
              }

              const now = Date.now();
              if (now - lastProgressTime >= 100) { // report progress at 10Hz
                lastProgressTime = now;
                reportProgress(path.basename(currentItem.dest), prog.speedBytesPerSec);
              }
            }
          })
            .then((res) => {
              completedItems++;
              activeWorkers--;

              // If file was tiny and didn't trigger chunk progress callbacks
              if (itemReceivedBytes === 0 && res && res.totalBytes) {
                downloadedBytesSum += res.totalBytes;
              } else if (itemReceivedBytes === 0 && currentItem.size) {
                downloadedBytesSum += currentItem.size;
              }

              reportProgress(path.basename(currentItem.dest));
              next();
            })
            .catch((err) => {
              console.error(`Failed downloading ${currentItem.url}:`, err);
              errors.push(err);
              activeWorkers--;
              next();
            });
        }
      };

      next();
    });
  }
}

module.exports = new Downloader();
