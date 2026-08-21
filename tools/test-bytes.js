const { app, nativeImage } = require('electron');
app.whenReady().then(() => {
  const img = nativeImage.createFromPath('C:/Users/takamura/.gemini/antigravity/brain/5d5b4ebc-a280-4ba6-befa-1eafaca536c6/.user_uploaded/media_1787327732064.jpg');
  const bmp = img.resize({ width: 10, height: 10 }).toBitmap();
  console.log('Buffer length:', bmp.length, 'Bitmap bytes [0,1,2,3]:', bmp[0], bmp[1], bmp[2], bmp[3]);
  app.quit();
});
