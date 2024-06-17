import crypto from 'crypto';
import fs from 'fs';

export const createMD5 = (path: string) => new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const rs = fs.createReadStream(path)
    rs.on('error', reject)
    rs.on('data', chunk => hash.update(chunk))
    rs.on('end', () => resolve(hash.digest('hex')))
});