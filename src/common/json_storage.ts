import fs from 'fs';
import path from 'path';

interface Storage {
    saveData(folder: string, filename: string, data: any): void;
    getData(folder: string, filename: string): any;

}

class JSONStorage {
    private readonly storage_dir: string = path.join(__dirname, '..', '..', 'storage');

    constructor() { }

    saveData(folder: string, filename: string, data: any) {
        const dirPath = path.join(this.storage_dir, folder);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        const filePath = path.join(dirPath, filename);

        if (filePath.endsWith('.pdf')) fs.writeFileSync(filePath, data, 'binary');
        else fs.writeFileSync(filePath, JSON.stringify(data));
    }

    getData(folder: string, filename: string) {
        const filePath = path.join(this.storage_dir, folder, filename);
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
}

export {
    Storage,
    JSONStorage
}