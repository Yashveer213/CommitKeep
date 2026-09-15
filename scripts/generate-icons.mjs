import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
const source=new URL("../public/favicon.svg",import.meta.url);const icons=new URL("../public/icons/",import.meta.url);await mkdir(icons,{recursive:true});
for(const size of [16,32,48,192,512])await sharp(fileURLToPath(source)).resize(size,size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`,icons)));
await sharp(fileURLToPath(source)).resize(180,180).png().toFile(fileURLToPath(new URL("../public/apple-touch-icon.png",import.meta.url)));
await sharp(fileURLToPath(source)).resize(410,410).extend({top:51,bottom:51,left:51,right:51,background:"#0b0b0c"}).png().toFile(fileURLToPath(new URL("icon-maskable-512.png",icons)));
