import * as lib from './lib.js';
let dbexists = false;
let data = {
    TRACES: ["504 Gateway"]
};
var $outputElm = document.getElementById('output');
var $errorElm = document.getElementById('error');
let $binselement = document.getElementById('numbins');
var $dbFileElm = document.getElementById('dbfile');
// var savedbElm = document.getElementById('savedb');    
var $myPlot = document.getElementById('myDiv');
var $listOfTracesElement = document.getElementById('listOfTraces');
var $btnAddTrace = document.getElementById("btnAdd");
// Function to render the UI into the DOM
var renderTracesList = function () {
    if ($listOfTracesElement.firstChild)
        $listOfTracesElement.removeChild($listOfTracesElement.firstChild);
    let lis = data.TRACES.map((t) => {
        let li = document.createElement('li');
        li.innerText = t;
        let but = document.createElement('button');
        but.innerText = '❌';
        but.onclick = function () {
            data.TRACES = data.TRACES.filter(f => f !== t);
            li.remove();
            LoadGraph();
        };
        li.appendChild(but);
        return li;
    });
    var ul = document.createElement('ul');
    ul.appendChildren(...lis);
    $listOfTracesElement.appendChild(ul);
};
function getTrace(messageContents, color) {
    let numbinstxt = $binselement.value;
    let numbins = Math.max(10, parseInt(numbinstxt));
    let data1Promise = lib.execSQL(`select UnixTS from Logs1 where message like '%${messageContents}%'`)
        //.then(render)
        .then((r) => {
        if (r.length)
            return r[0].values.flat();
        return [];
    })
        .then(x1 => {
        var trace1 = {
            x: x1,
            name: messageContents,
            type: "histogram",
            opacity: 0.3,
            marker: {
                color: color,
            },
            nbinsx: numbins,
        };
        return trace1;
    });
    return data1Promise;
}
function LoadGraph() {
    if (!dbexists)
        return;
    var items = data.TRACES; // ta.value.split("\n");
    var traces = [];
    var colorgenerator = lib.getColorGenerator();
    for (const q of items) {
        traces.push(getTrace(q, (colorgenerator.next().value)));
    }
    // var traces = [getTrace("504"),getTrace('discon')];
    Promise.all(traces).then(arr => {
        var layout = {
            barmode: "overlay",
            xaxis: {
                title: 'UnixTs(ms)',
                showexponent: 'none',
                exponentformat: 'none',
                color: "gray",
                tickangle: 45,
                dtick: 1000 * 60,
                tickformat: "Q",
            },
            yaxis: {
                title: '# of Event Occurances',
                color: 'gray',
            },
            showlegend: true,
            paper_bgcolor: "black",
            plot_bgcolor: 'black',
        };
        Plotly.purge('myDiv');
        Plotly.newPlot('myDiv', arr, layout, {})
            .then(e => {
            e.on('plotly_click', function (data) {
                // console.log(data);
                var points = data.points.map(p => {
                    var idxs = p.pointIndices;
                    return idxs.map(i => p.data.x[i]);
                });
                var times = points.flat();
                let min, max = 0;
                if (!times.length) {
                    return;
                }
                min = Math.min(...times);
                max = Math.max(...times);
                let from = new Date(min * 1000);
                let to = new Date(max * 1000);
                let durationms = Math.abs(from - to);
                console.log(`Time from ${new Date(min * 1000)} to ${new Date(max * 1000)}`);
                console.log(`Time duration ${durationms / 60000}min`);
                lib.execSQL(`select PartitionKey,Timestamp,ThreadId,CallingClass,Message from Logs1 where UnixTS >= ${min} and UnixTS <= ${max} order by UnixTS asc`)
                    .then(renderTables);
            });
        });
    });
}
function renderTables(results) {
    $outputElm.innerHTML = "";
    for (var i = 0; i < results.length; i++) {
        $outputElm.appendChild(lib.tableCreate(results[i]));
    }
    console.log(`Rendered ${results.length} Tables`);
    return results;
}
$btnAddTrace.addEventListener("click", (e) => {
    let res = prompt("Enter trace text in the message", "504 Gateway");
    data.TRACES.push(res);
    renderTracesList();
    LoadGraph();
});
renderTracesList();
$binselement.onchange = function () {
    LoadGraph();
};
// Load a db from a file
$dbFileElm.onchange = function () {
    var f = $dbFileElm.files[0];
    var r = new FileReader();
    r.onload = function () {
        lib.loadSqliteFromBuffer(r.result)
            .then(() => {
            console.log("Loaded db");
            dbexists = true;
            lib.execSQL("SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%';").then((a) => {
                if (a[0].values[0] != "Logs1") {
                    alert("There needs to be a table named Logs1");
                }
                lib.execSQL("pragma table_info('Logs1');").then((d) => {
                    var found = d[0].values.filter(r => r[1] == 'UnixTS').length == 1;
                    if (!found) {
                        var prepare = `
    --sql

delete from Logs1 where Logs1.PartitionKey = 'AppsFramework';
delete from Logs1 where Logs1.PartitionKey = 'BatchService';
delete from Logs1 where Logs1.PartitionKey = 'Repository';
delete from Logs1 where Logs1.PartitionKey = 'OmniService';

CREATE TABLE "sqlb_temp_table_1" (
	"PartitionKey"	TEXT,
	"Timestamp"	TEXT,
	"UnixTS" INTEGER,
	"MachineName"	TEXT,
	"Message"	TEXT,
	"CallingClass"	TEXT,
	"ThreadId"	INTEGER,
	"LogCode"	INTEGER
);

INSERT INTO "main"."sqlb_temp_table_1" ("CallingClass","LogCode","MachineName","Message","PartitionKey","ThreadId","Timestamp","UnixTS") 
	SELECT "CallingClass","LogCode","MachineName","Message","PartitionKey","ThreadId",datetime(Timestamp) as "Timestamp",CAST(strftime('%s', datetime(Timestamp)) AS INT) as UnixTS
	FROM "main"."Logs1";


DROP TABLE "main"."Logs1";
ALTER TABLE "main"."sqlb_temp_table_1" RENAME TO "Logs1";
CREATE INDEX [idxts] ON "Logs1" ([UnixTS]);

    `;
                        console.log("applying transformations");
                        lib.execSQL(prepare).then(console.log).catch(console.error).then(LoadGraph);
                        return;
                    }
                    LoadGraph();
                });
                //there is a logs1, check for structure
            });
        });
    };
    r.readAsArrayBuffer(f);
};
// Save the db to a file
// function savedb() {
//     worker.onmessage = function (event) {
//     toc("Exporting the database");
//     var arraybuff = event.data.buffer;
//     var blob = new Blob([arraybuff]);
//     var a = document.createElement("a");
//     document.body.appendChild(a);
//     a.href = window.URL.createObjectURL(blob);
//     a.download = "sql.db";
//     a.onclick = function () {
//         setTimeout(function () {
//             window.URL.revokeObjectURL(a.href);
//         }, 1500);
//     };
//     a.click();
//     };
//     tic();
//     worker.postMessage({ action: 'export' });
// }
//#region 
//let data1Promise = fetch('test.json').then(data => data.json());
// let data2Promise = fetch('test2.json').then(data => data.json());
// let data3Promise = fetch('test3.json').then(data => data.json());
// Promise.all([data1Promise, data2Promise, data3Promise]).then((arr) => {
//     let x1 = arr[0];
//     let x2 = arr[1];
//     let x3 = arr[2];
//     var trace1 = <Partial<Plotly.PlotData>>{
//         x: x1,
//         name:""
//         type: "histogram",
//         opacity: 0.2,
//         marker: {
//             color: 'green',
//         },
//         nbinsx: 1000
//     };
//     var trace2 = <Partial<Plotly.PlotData>>{
//         x: x2,
//         type: "histogram",
//         opacity: 0.2,
//         marker: {
//             color: 'red',
//         },
//         nbinsx: 1000
//     };
//     var trace3 = <Partial<Plotly.PlotData>>{
//         x: x2,
//         type: "histogram",
//         opacity: 0.2,
//         marker: {
//             color: 'purple',
//         },
//         nbinsx: 1000
//     };
//     var data = [trace1, trace2, trace3];
//     var layout = <Partial<Plotly.Layout>>{
//         barmode: "overlay",
//         xaxis: {
//             showexponent: 'none',
//             exponentformat: 'none',
//         }
//     };
//     Plotly.newPlot('myDiv', data, layout);
// });
////#endregion
//savedbElm.addEventListener("click", savedb, true);
// execBtn.addEventListener("click", execEditorContents, true);
// // Add syntax highlihjting to the textarea
// var editor = CodeMirror.fromTextArea(commandsElm, {
// 	mode: 'text/x-mysql',
// 	viewportMargin: Infinity,
// 	indentWithTabs: true,
// 	smartIndent: true,
// 	lineNumbers: true,
// 	matchBrackets: true,
// 	autofocus: true,
// 	extraKeys: {
// 		"Ctrl-Enter": execEditorContents,
// 		"Ctrl-S": savedb,
// 	}
// });
