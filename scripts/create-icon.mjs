import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.join(__dirname, '..', 'build');
const inputImage = path.join(buildDir, 'icon_original.jpg');
const pngOutput = path.join(buildDir, 'icon.png');
const icoOutput = path.join(buildDir, 'icon.ico');

async function createIcon() {
  console.log('Procesando imagen...');
  
  // Redimensionar y convertir a PNG cuadrado de 256x256
  await sharp(inputImage)
    .resize(256, 256, { fit: 'cover' })
    .png()
    .toFile(pngOutput);
  
  console.log('PNG creado:', pngOutput);
  
  // Convertir PNG a ICO
  const icoBuffer = await pngToIco(pngOutput);
  fs.writeFileSync(icoOutput, icoBuffer);
  
  console.log('ICO creado:', icoOutput);
  console.log('¡Ícono listo!');
}

createIcon().catch(console.error);
