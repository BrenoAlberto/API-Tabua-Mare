import { CheerioAPI, Element, AnyNode, load as cheerio_load } from 'cheerio'
import { httpSnapshots, HTTP } from "../common/http"
import { Storage, JSONStorage } from "../common/json_storage"


type TabuasTableByYear = {
    year: number,
    states: {
        [state: string]: StateTable[]
    }
}

type StateTable = {
    title: string,
    tabuaPDFURL: string
}

class MarinhaMaredataWorker {
    private readonly TabuasURLByYear = {
        2023: 'https://www.marinha.mil.br/chm/tabuas-de-mare',
        2024: 'https://www.marinha.mil.br/chm/tabuas-de-mare-2024'
    }

    private CSSSelectors = {
        Tables: 'table.views-table',
        TableCaption: 'caption',
        TableHeader: 'thead tr th',
        TableBody: 'tbody tr',
        TableBodyCell: 'td',
        TableBodyCellLink: 'a'
    }

    constructor(
        private readonly http: HTTP,
        private readonly storage: Storage
    ) {}

    async downloadAllTabuasPDFs(tabuasTableByYear: TabuasTableByYear) {
        for (const state in tabuasTableByYear.states) {
            const stateTables = tabuasTableByYear.states[state]
            for (const stateTable of stateTables) {
                const response = await this.http.get(stateTable.tabuaPDFURL, true)
                const buffer = Buffer.from(await response.arrayBuffer())
                const filename = `${stateTable.title}.pdf`
                const folder = `marinha-maredata/tabuas/${state}`
                this.storage.saveData(folder, filename, buffer)
            }
        }
    }

    async getAvailableTabuasByYear(year: keyof typeof this.TabuasURLByYear) {
        const storedData = this.storage.getData('marinha-maredata', `tabuas-${year}.json`)
        if (storedData) return storedData
        const response = await this.http.get(
            this.TabuasURLByYear[year], true
        )
        const responseText = await response.text()
        const $ = cheerio_load(responseText)
        const tabuasData = await this._extractAvailableTabuasHTMLData($, year)
        this.storage.saveData('marinha-maredata', `tabuas-${year}.json`, tabuasData)
        return tabuasData
    }

    private async _extractAvailableTabuasHTMLData(
        $: CheerioAPI, year: keyof typeof this.TabuasURLByYear
    ): Promise<TabuasTableByYear> {
        const statesData: { [state: string]: StateTable[] } = {};

        $(this.CSSSelectors.Tables).each((_, table) => {
            const [ stateName, stateTables ] = this._parseStateTable($, table)
            if (stateTables.length) {
                statesData[stateName] = stateTables
            }
        });

        return {
            year: Number(year),
            states: statesData
        };
    }

    private _parseStateTable($: CheerioAPI, table: AnyNode): [string, StateTable[]] {
        const stateName = $(table).find(this.CSSSelectors.TableCaption).text().trim()
        const stateTables: StateTable[] = []

        $(table).find(this.CSSSelectors.TableBody).each((_, row) => {
            const stateTableData = this._parseStateRow($, row)
            if (stateTableData) stateTables.push(stateTableData)
        })

        return [ stateName, stateTables ]
    }

    private _parseStateRow($: CheerioAPI, row: Element) {
        const tableRow = $(row)
        const tableCells = tableRow.find(this.CSSSelectors.TableBodyCell)
        const tableRowTitle = tableCells.eq(0).text().trim()
        const tableRowPDFURL = tableCells.eq(1).find(this.CSSSelectors.TableBodyCellLink).attr('href') || ''

        if (tableRowTitle && tableRowPDFURL) {
            return {
                title: tableRowTitle,
                tabuaPDFURL: tableRowPDFURL
            }
        }
        return null;
    }
}

(async () => {


const marinhaMaredataWorker = new MarinhaMaredataWorker(
    httpSnapshots,
    new JSONStorage()
)


const data = await marinhaMaredataWorker.getAvailableTabuasByYear(2024)
await marinhaMaredataWorker.downloadAllTabuasPDFs(data)
})()