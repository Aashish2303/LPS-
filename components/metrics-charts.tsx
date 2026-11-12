const chartColors = [
  '#ffcf4d', '#55dbc2', '#8298ff', '#f28e94', '#9ad882', '#dfb8fa', '#63c8f5', '#eea26e',
  '#e2df82', '#57b59f', '#ad9ae6', '#faafd5', '#9eb4c5', '#d4a579', '#f57c63', '#a7d1b9',
];

export function PpcTrend({points}:{points:{week:string;label:string;ppc:number}[]}){
  const width = Math.max(580, points.length * 68 + 68);
  const left = 48;
  const right = width - 28;
  const y = (value:number) => 185 - value * 1.45;
  const plotted = points.map((point, i) => ({
    ...point, x:points.length === 1 ? (left+right)/2 : left + (right-left)*i/(points.length-1),
    y:y(point.ppc),
  }));
  return <div className="chartscroll">
    <svg role="img" aria-label="Weekly PPC for closed weeks, with an 80 percent reference line" viewBox={`0 0 ${width} 228`} style={{minWidth:width}}>
      {[0,25,50,75,100].map(value=><g key={value}>
        <line className="trendgrid" x1={left} y1={y(value)} x2={right} y2={y(value)}/>
        <text className="trendlabel" textAnchor="end" x={left-7} y={y(value)+4}>{value}%</text>
      </g>)}
      <line className="trendtarget" x1={left} y1={y(80)} x2={right} y2={y(80)}/>
      <polyline className="trendline" points={plotted.map(point=>point.x+','+point.y).join(' ')}/>
      {plotted.map(point=><g key={point.week}>
        <circle className="trendpoint" cx={point.x} cy={point.y} r={5}><title>{point.label}: {point.ppc}% PPC</title></circle>
        <text className="trendvalue" textAnchor="middle" x={point.x} y={point.y-12}>{point.ppc}%</text>
        <text className="trendlabel" textAnchor="middle" x={point.x} y={211}>{point.label}</text>
      </g>)}
    </svg>
  </div>;
}

export function ReasonPie({rows}:{rows:{code:string;label:string;count:number}[]}){
  const total = rows.reduce((sum,row)=>sum+row.count,0);
  let offset = 0;
  const segments = rows.map((row,i)=>{
    const start=offset;
    offset+=row.count;
    return chartColors[i%chartColors.length]+' '+(start/total*100)+'% '+(offset/total*100)+'%';
  });
  return <div className="reasonpie">
    <div className="piechart" aria-hidden="true" style={{background:'conic-gradient('+segments.join(',')+')'}}/>
    <ul aria-label="Reasons for missed promises">
      {rows.map((row,i)=><li key={row.code}><i style={{background:chartColors[i%chartColors.length]}}/><span>{row.label}</span><strong>{row.count} · {(row.count/total*100).toFixed(1)}%</strong></li>)}
    </ul>
  </div>;
}
