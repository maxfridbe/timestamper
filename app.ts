import * as lib from './lib.js';



var $outputElm = document.getElementById('output');
var $errorElm = document.getElementById('error');
var $prog = document.getElementById("prog");
let $binselement = (<HTMLInputElement>document.getElementById('numbins'));

var $dbFileElm = <HTMLInputElement>document.getElementById('dbfile');
// var savedbElm = document.getElementById('savedb');    
var $myPlot = <HTMLDivElement>document.getElementById('myDiv');
var $listOfTracesElement = document.getElementById('listOfTraces');
var $btnAddTrace = document.getElementById("btnAdd");




let dbexists = false;
var tableName = "Logs";
let data = {
    TRACES: ["discon"]
};



let param = new URLSearchParams(window.location.search);

var dburl = param.get("db");

if (dburl) {
    dburl = atob(dburl);
    loadDbFromUrl(dburl);
}

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
        }
        li.appendChild(but);
        return li;
    });
    var ul = document.createElement('ul');
    ul.appendChildren(...lis);
    $listOfTracesElement.appendChild(ul);
};



function getTrace(messageContents: string, color: string) {
    let numbinstxt = $binselement.value;
    let numbins = Math.max(10, parseInt(numbinstxt));
    let data1Promise = 
        lib.execSQL(`select Timestamp as UnixTS from ${tableName} where message like '%${messageContents}%'`)
        //.then(render)
        .then((r: any) => {
            if (r.length)
                return r[0].values.flat();
            return [];
        })
        .then(x1 => {

            //  var format = {year: '2-digit', month: '2-digit', day: '2-digit', hour:};
            let x = x1.map(unix => new Date(unix).toISOString());//new Date(unix ));


            var trace1 = <Partial<Plotly.PlotData>>{
                x: x,
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

// function zeropad(num, maxsize) {
//     var s = num+"";
//     var size = (maxsize+"").length;
//     while (s.length < size) s = "0" + s;
//     return s;
//   }

//   function DateJSON2plotly(jsdate) {
//     var td = new Date(jsdate);
//     var dateStr = "" + td.getUTCFullYear() + '-' + zeropad(td.getUTCMonth(),10) + '-' + zeropad(td.getUTCDate(),10) + ' ' +
//              zeropad(td.getUTCHours(),10) + ':' + zeropad(td.getUTCMinutes(),10) + ':' + zeropad(td.getUTCSeconds(),10);
//     return dateStr;
//   }

//   function ISODateString(unix:number) {
//     var d = new Date(unix);
//     function pad(n) {return n<10 ? '0'+n : n}
//     return d.getUTCFullYear()+'-'
//          + pad(d.getUTCMonth()+1)+'-'
//          + pad(d.getUTCDate())+'T'
//          + pad(d.getUTCHours())+':'
//          + pad(d.getUTCMinutes())+':'
//          + pad(d.getUTCSeconds())+'Z'
// }

function LoadGraph() {
    if (!dbexists)
        return;
    var items = data.TRACES;// ta.value.split("\n");

    var traces = [];
    var colorgenerator = lib.getColorGenerator();

    for (const q of items) {
        traces.push(getTrace(q, <string>(colorgenerator.next().value)));
    }
    let numbinstxt = $binselement.value;

    // var traces = [getTrace("504"),getTrace('discon')];
    Promise.all(traces).then(arr => {
        var layout = <Partial<Plotly.Layout>>{
            barmode: "overlay",
            xaxis: {
                title: 'GMT',
                showexponent: 'none',
                exponentformat: 'none',
                color: "gray",
                tickangle: 45,
                nticks: parseInt(numbinstxt) / 2,
                // dtick: 1000 * 60,
                //hoverformat:"%L",
                //tickformat: "%c"//"%X %-m/%-d/%y", //https://plotly.com/chart-studio-help/date-format-and-time-series/
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
                $prog.style.display = "none";
                e.on('plotly_selected',(d)=>{
                    console.log(data);
                });
                e.on('plotly_click', function (data: Plotly.PlotMouseEvent) {
                    // console.log(data);
                    var points = data.points.map(p => {
                        var idxs: number[] = (<any>p).pointIndices;
                        return idxs.map(i => p.data.x[i]);
                    });

                    var times: number[] = (<any>points).flat().map(p=>new Date(p).getTime());
                    let min, max = 0;

                    if (!times.length) {
                        return;
                    }

                    min = Math.min.apply(null, times);
                    max = Math.max.apply(null, times);
                    if(min == max){
                    min-=100;
                    max+=100;
                    }


                    let from = new Date(min);
                    let to = new Date(max);

                    let durationms = Math.abs(<any>from - <any>to);
                    console.log(`Time from ${from} to ${to}`);
                    console.log(`Time duration ${durationms / 60000}min`);

                    //SELECT "_rowid_","id","PartitionKey","MachineName",strftime('%Y-%m-%d %H:%M:%S.', "Timestamp"/1000, 'unixepoch') || ("Timestamp"%1000) AS "Timestamp","Message","CallingClass","LogCode","ThreadId" FROM "main"."Logs" WHERE PartitionKey LIKE '%a%' ESCAPE '\' ORDER BY "Timestamp" DESC LIMIT 0, 49999;

                    lib.execSQL(`
                            select 
                                PartitionKey,
                                LogCode,
                                strftime('%Y-%m-%d %H:%M:%S.', "Timestamp"/1000, 'unixepoch') || ("Timestamp"%1000) AS "Timestamp", 
                                --"Timestamp" AS UnixTS,
                                ThreadId,
                                CallingClass,
                                Message 
                            from ${tableName} 
                            where 
                                Timestamp >= ${min} 
                                and Timestamp <= ${max} 
                            order by Timestamp asc`)
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

    //tweak based on contents
    var rows = document.getElementsByTagName("tr");
    for (const r of rows) {
        var n = [...r.childNodes];

        var foundError = n.filter(f => f.textContent.indexOf("Error") != -1);
        if (foundError.length) {
            r.classList.add("error");
        }
        var foundWarning = n.filter(f => f.textContent.indexOf("Warn") != -1);
        if (foundWarning.length) {
            r.classList.add("warn");
        }
    }

    return results;
}

$btnAddTrace.addEventListener("click", (e) => {
    let res = prompt("Enter trace text in the message", "discon");
    data.TRACES.push(res);
    renderTracesList();
    LoadGraph();
});



$binselement.onchange = function () {
    LoadGraph();
}
// Load a db from a file
$dbFileElm.onchange = function () {
    $prog.style.display = "inline-block";
    var f = $dbFileElm.files[0];
    var r = new FileReader();
    r.onload = function () {
        loadBuffer(<ArrayBuffer>(r.result));
    }
    r.readAsArrayBuffer(f);
}
function loadDbFromUrl(dburl: string) {
    // fetch(dburl, {
    //     "headers": {
    //       "Access-Control-Allow-Origin":"*",
    //       "accept": "*/*",
    //       "accept-language": "en-US,en;q=0.9",
    //       "cache-control": "no-cache",
    //       "pragma": "no-cache",
    //     },
    //     "body": null,
    //     "method": "GET",
    //     "mode": "no-cors",
    //     "credentials": "omit"
    //   })
    //   .then((response)=>{
    //         console.log(response);

    //   });


    return fetch(dburl, {
        mode: 'cors',
        headers: {
            'Access-Control-Allow-Origin': '*'
        }
    })
        .then((response) => {
            //console.log(response);
            return response.arrayBuffer();
        })
        .then((buffer) => loadBuffer(buffer));


    // const req = new XMLHttpRequest();
    // req.open("GET", dburl, true);
    // //req.responseType = "blob";
    // req.setRequestHeader("Access-Control-Allow-Origin","*");

    // req.onload = (event) => {
    //   const blob = req.response;
    //   loadBuffer(blob);
    // };

    // req.send();

};

function loadBuffer(r: ArrayBuffer) {
    lib.loadSqliteFromBuffer(r)
        .then(() => {
            console.log("Loaded db");
            dbexists = true;

            lib.execSQL("SELECT name FROM sqlite_master WHERE type ='table' AND name NOT LIKE 'sqlite_%';").then((a) => {
                if (a[0].values[0][0] != tableName) {
                    tableName = <string>a[0].values[0][0];
                    alert(`Using table named ${tableName}`);
                }

                LoadGraph();

            });
        });
}


function downloadURI(uri, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    link.click();
}



renderTracesList();



//                 lib.execSQL(`pragma table_info('${tableName}');`).then((d) => {
//                     var found = d[0].values.filter(r => r[1] == 'UnixTS').length == 1;
//                     if (!found) {
//                         var prepare = `
//     --sql

// delete from ${tableName} where [${tableName}].[PartitionKey] = 'AppsFramework';
// delete from ${tableName} where [${tableName}].[PartitionKey] = 'BatchService';
// delete from ${tableName} where [${tableName}].[PartitionKey] = 'Repository';
// delete from ${tableName} where [${tableName}].[PartitionKey] = 'OmniService';

// CREATE TABLE "sqlb_temp_table_1" (
// 	"PartitionKey"	TEXT,
// 	"Timestamp"	TEXT,
// 	"UnixTS" INTEGER,
// 	"MachineName"	TEXT,
// 	"Message"	TEXT,
// 	"CallingClass"	TEXT,
// 	"ThreadId"	INTEGER,
// 	"LogCode"	INTEGER
// );

// INSERT INTO "main"."sqlb_temp_table_1" ("CallingClass","LogCode","MachineName","Message","PartitionKey","ThreadId","Timestamp","UnixTS") 
// 	SELECT "CallingClass","LogCode","MachineName","Message","PartitionKey","ThreadId",datetime(Timestamp) as "Timestamp",CAST(strftime('%s', datetime(Timestamp)) AS INT) as UnixTS
// 	FROM "main"."${tableName}";


// DROP TABLE "main"."${tableName}";
// ALTER TABLE "main"."sqlb_temp_table_1" RENAME TO "${tableName}";
// CREATE INDEX [idxts] ON "${tableName}" ([UnixTS]);

//     `;
//                         console.log("applying transformations");

//                         lib.execSQL(prepare).then(console.log).catch(console.error).then(LoadGraph);
//                         return;
//                     }









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

