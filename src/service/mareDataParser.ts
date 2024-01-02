import fs from 'fs';
import path from 'path';
import { Storage } from '../common/json_storage';

type DayData = {
    date: string,
    day: string,
    tides: Array<{ time: string, height: number }>
}

class TidalDataParser {

    constructor(private readonly storage: Storage) { }

    public parseToJSON(
        stateName: string, stateFileTitle: string
    ): void {
        const textFilename = `${stateFileTitle}.txt`
        const textFolder = `marinha-maredata/tabuas-text/${stateName}`
        const stateTextPath = path.join(
            __dirname, '..', '..', 'storage', textFolder, textFilename
        );

        const rawData = fs.readFileSync(stateTextPath, 'utf8');
        try {
            const jsonData = this.parseText(rawData);
    
            const jsonFolder = `marinha-maredata/tabuas-json/${stateName}`
            const jsonFilename = `${stateFileTitle}.json`
            this.storage.saveData(jsonFolder, jsonFilename, jsonData)
        } catch (error) {
            console.error(`Error parsing ${stateTextPath}`)
        }
    }

    private parseText(text: string): DayData[] {
        const monthsData = this.extractMonthsData(text);
        const daysData = monthsData.flatMap(monthData => {
            const daysData = this.extractDaysData(monthData);
            return daysData.map(dayData => this.extractDayData(dayData));
        });
        return daysData;
    }

    private extractMonthsData(tabuaText: string): string[] {
        const pattern = /01\\n\w{3}\\n.*?(?=\\n01\\n\w{3}\\n|$)/g;
        const matches = tabuaText.match(pattern);
        if (matches) {
            return matches;
        }

        throw new Error(
            'No matches found for months data - probably an image pdf'
        );
    }

    private extractDaysData(monthText: string): string[] {
        const pattern = /(\d{2})\\n\w{3}\\n(?:.*?)(?=\\n\d{2}\\n\w{3}\\n|$)/g;
        const matches = monthText.match(pattern);
        if (matches) {
            return matches;
        }

        throw new Error('No matches found for days data');
    }

    private extractDayData(dayText: string): DayData {
        const datePattern = /(\d{2})\\n(\w{3})/g;
        const tidesPattern = /(\d{4})\s+(\d\.\d)/g;

        const dateMatch = datePattern.exec(dayText);
        const tidesMatches = dayText.matchAll(tidesPattern);

        if (dateMatch) {
            const [_, date, day] = dateMatch;
            const tides = Array.from(tidesMatches).map(match => {
                const [_, time, height] = match;
                return { time, height: parseFloat(height) };
            });
            return { date, day, tides };
        }
        

        throw new Error('No matches found for day data');
    }

}

export {
    TidalDataParser
}