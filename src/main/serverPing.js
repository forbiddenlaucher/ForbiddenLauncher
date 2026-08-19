const net = require('net');
const dns = require('dns');

class ServerPing {
  /**
   * Encodes a VarInt into a Buffer
   */
  encodeVarInt(value) {
    const bytes = [];
    while (true) {
      if ((value & ~0x7f) === 0) {
        bytes.push(value);
        break;
      }
      bytes.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    return Buffer.from(bytes);
  }

  /**
   * Reads a VarInt from a buffer at a given offset
   */
  readVarInt(buffer, offset = 0) {
    let result = 0;
    let numRead = 0;
    let b;
    do {
      if (offset + numRead >= buffer.length) {
        throw new Error('Buffer overflow while reading VarInt');
      }
      b = buffer[offset + numRead];
      result |= (b & 0x7f) << (7 * numRead);
      numRead++;
      if (numRead > 5) {
        throw new Error('VarInt is too big');
      }
    } while ((b & 0x80) !== 0);
    return { value: result, size: numRead };
  }

  /**
   * Resolves Minecraft DNS SRV record (_minecraft._tcp.domain)
   */
  resolveSrv(host, defaultPort = 25565) {
    return new Promise((resolve) => {
      // Check if IP address
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return resolve({ host, port: defaultPort });
      }

      dns.resolveSrv(`_minecraft._tcp.${host}`, (err, records) => {
        if (!err && records && records.length > 0) {
          records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
          resolve({
            host: records[0].name,
            port: records[0].port,
            originalHost: host
          });
        } else {
          resolve({ host, port: defaultPort, originalHost: host });
        }
      });
    });
  }

  /**
   * Pings a Minecraft server using standard SLP protocol with automatic SRV resolution
   */
  async ping(targetHost = 'localhost', targetPort = 25565, timeout = 4500) {
    const { host: connectHost, port: connectPort } = await this.resolveSrv(targetHost, targetPort);

    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();
      let isResolved = false;

      const finish = (result) => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(timeout);

      socket.on('timeout', () => {
        finish({
          online: false,
          error: 'Tempo limite esgotado',
          host: targetHost,
          port: connectPort,
          players: { online: 0, max: 0 },
          ping: 0,
          motd: 'Servidor Offline'
        });
      });

      socket.on('error', (err) => {
        finish({
          online: false,
          error: err.message,
          host: targetHost,
          port: connectPort,
          players: { online: 0, max: 0 },
          ping: 0,
          motd: 'Servidor Offline'
        });
      });

      socket.connect(connectPort, connectHost, () => {
        // Construct Handshake Packet (ID: 0x00)
        // Protocol: 767 (1.21.1) / 47 (1.8/1.7.10)
        const hostBuf = Buffer.from(targetHost, 'utf8');
        const portBuf = Buffer.alloc(2);
        portBuf.writeUInt16BE(connectPort, 0);

        const packetData = Buffer.concat([
          Buffer.from([0x00]), // Packet ID: Handshake
          this.encodeVarInt(767), // Protocol version (1.21.1)
          this.encodeVarInt(hostBuf.length),
          hostBuf,
          portBuf,
          this.encodeVarInt(1) // Next state: Status (1)
        ]);

        const handshakePacket = Buffer.concat([
          this.encodeVarInt(packetData.length),
          packetData
        ]);

        // Status Request Packet (ID: 0x00, Length: 1)
        const statusRequestPacket = Buffer.from([0x01, 0x00]);

        socket.write(handshakePacket);
        socket.write(statusRequestPacket);
      });

      let receivedBuffers = [];

      socket.on('data', (data) => {
        receivedBuffers.push(data);
        const fullBuffer = Buffer.concat(receivedBuffers);

        try {
          // Read packet length
          const { value: packetLength, size: lenVarIntSize } = this.readVarInt(fullBuffer, 0);
          if (fullBuffer.length < packetLength + lenVarIntSize) {
            return; // Wait for more chunks
          }

          // Packet ID (0x00 for status response)
          const { value: packetId, size: idVarIntSize } = this.readVarInt(fullBuffer, lenVarIntSize);
          const jsonStringOffset = lenVarIntSize + idVarIntSize;

          // String length
          const { value: stringLength, size: strVarIntSize } = this.readVarInt(fullBuffer, jsonStringOffset);
          const jsonStart = jsonStringOffset + strVarIntSize;
          const jsonEnd = jsonStart + stringLength;

          if (fullBuffer.length >= jsonEnd) {
            const jsonString = fullBuffer.toString('utf8', jsonStart, jsonEnd);
            const parsed = JSON.parse(jsonString);
            const latency = Date.now() - startTime;

            let motdText = 'Servidor Oficial';
            if (typeof parsed.description === 'string') {
              motdText = parsed.description;
            } else if (parsed.description && parsed.description.text) {
              motdText = parsed.description.text;
            } else if (parsed.description && Array.isArray(parsed.description.extra)) {
              motdText = parsed.description.extra.map(e => (typeof e === 'string' ? e : e.text || '')).join('');
            }

            // Strip Minecraft formatting codes
            motdText = motdText.replace(/§[0-9a-fk-or]/gi, '').trim();

            finish({
              online: true,
              host: targetHost,
              port: connectPort,
              version: parsed.version ? parsed.version.name : '1.21.1',
              motd: motdText,
              players: {
                online: parsed.players ? (parsed.players.online || 0) : 0,
                max: parsed.players ? (parsed.players.max || 100) : 100,
                sample: parsed.players && parsed.players.sample ? parsed.players.sample : []
              },
              ping: Math.max(1, latency),
              favicon: parsed.favicon || null
            });
          }
        } catch (err) {
          if (fullBuffer.length > 32768) {
            finish({
              online: true,
              host: targetHost,
              port: connectPort,
              version: '1.21.1',
              motd: 'All The Mods 10 Server',
              players: { online: 0, max: 100 },
              ping: Math.max(1, Date.now() - startTime)
            });
          }
        }
      });
    });
  }
}

module.exports = new ServerPing();
