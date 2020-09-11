interface ISQLStatementResult {
    columns: string[];
    values: (string | number)[];
}

// Start the worker in which sql.js will run
var worker = new Worker("worker.sql-wasm.js");
worker.onerror = console.error;

// Open a database
worker.postMessage({ action: 'open' });

declare global {
    interface HTMLElement {
        appendChildren(...arr:HTMLElement[]): void;
    }
}
HTMLElement.prototype.appendChildren = function (...arr:HTMLElement[]) {
    for (var i = 0; i < arr.length; i++)

        this.appendChild(arr[i]);

};

let callDict = {};
worker.onmessage = function (event) {
    var results = event.data.results;
    var id = event.data.id;
    if (event.data.ready && !id) {
        if (sqlResolve) {
            sqlResolve();
            sqlResolve = null;
        }
        toc("Database Loaded");
        return;
    }

    var resolve = callDict[id];
    toc(`Executed SQL, ${id}`);
    delete (callDict[id])
    tic();
    resolve(results);
    toc("Notified of results");
}

// Performance measurement functions
var tictime;
if (!window.performance || !performance.now) { (<any>window).performance = { now: Date.now } }
function tic() { tictime = performance.now() }
function toc(msg) {
    var dt = performance.now() - tictime;
    console.log((msg || 'toc') + ": " + dt + "ms");
}
let sqlResolve = undefined;
export function loadSqliteFromBuffer(buffer) {
    return new Promise((resolve, reject) => {
        tic();
        sqlResolve = resolve;
        try {
            worker.postMessage({ action: 'open', buffer: buffer }, [buffer]);
        }
        catch (exception) {
            worker.postMessage({ action: 'open', buffer: buffer });
        }

    });

}

export function execSQL(commands: string): Promise<ISQLStatementResult[]> {

    return new Promise((resolve, reject) => {
        tic();
        callDict[commands] = resolve;
        worker.postMessage({ action: 'exec', sql: commands, id: commands });


    });
}

export function* getColorGenerator() {
    let arr = ['red', 'orange', 'yellow', 'green', 'blue', 'violet'];
    let i = 0;
   while(true){
       yield arr[i%6];
    i++;
   }
}


// Create an HTML table
function valconcat(vals, tagName) {
    if (vals.length === 0) return '';
    let open = '<' + tagName + '>';
    let close = '</' + tagName + '>';
    return open + vals.join(close + open) + close;
}
export function tableCreate( res:ISQLStatementResult) {
    var tbl = document.createElement('table');
    var th = document.createElement('thead');
    th.innerHTML = valconcat(res.columns, 'th');
    var tb = document.createElement('tbody');
    for (const row of res.values) {
        var tr = document.createElement('tr');
        for (const col of <any>row) {
            var td = document.createElement('td');
            td.innerText = col;
            tr.appendChild(td);
        }
        tb.appendChild(tr);
    }
    tbl.appendChild(th);
    tbl.appendChild(tb);
    return tbl;
}
