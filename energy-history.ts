/* Adapted from LUMORA Studio, MIT. See licenses/lumora-studio-MIT.txt. */
interface HomeAssistant {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
}
export type EnergyRange='day'|'month'|'year';
export type EnergyMetric='solar'|'import'|'export';
export interface EnergySources{solar:string[];import:string[];export:string[]}
export interface EnergyStat{start:number;end?:number;change?:number|null}
export type EnergyStats=Record<string,EnergyStat[]>;
export interface EnergyWindow{start:number;end:number;priorStart:number;priorEnd:number;period:'hour'|'day'|'month';zone:string;label:string;priorLabel:string}
interface Wall{year:number;month:number;day:number;hour:number;minute:number;second:number}
function wall(at:number,zone:string):Wall{const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(at);return Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)])) as unknown as Wall;}
const utc=(w:Wall)=>Date.UTC(w.year,w.month-1,w.day,w.hour,w.minute,w.second);
function instant(w:Wall,zone:string){let t=utc(w);for(let i=0;i<3;i++)t+=utc(w)-utc(wall(t,zone));return t;}
function prevYear(w:Wall):Wall{return {...w,year:w.year-1,day:Math.min(w.day,new Date(Date.UTC(w.year-1,w.month,0)).getUTCDate())};}
export function energyWindow(range:EnergyRange,now:number,zone='Europe/Berlin'):EnergyWindow{
 const e={...wall(now,zone),hour:range==='day'?wall(now,zone).hour:0,minute:0,second:0},s={...e,hour:0,day:range==='day'?e.day:1,month:range==='year'?1:e.month},end=instant(e,zone),start=instant(s,zone),ps=prevYear(s),pe=prevYear(e),format=(at:number)=>new Intl.DateTimeFormat('de-DE',{timeZone:zone,...(range==='day'?{day:'numeric',month:'long',year:'numeric'}:range==='month'?{month:'long',year:'numeric'}:{year:'numeric'})}).format(at);
 return {start,end,priorStart:instant(ps,zone),priorEnd:instant(pe,zone),period:range==='day'?'hour':'day',zone,label:format(start),priorLabel:format(instant(ps,zone))};
}
/** Past months cover the whole calendar month, including DST and leap years. */
export function energyMonthWindow(month:string,now:number,zone='Europe/Berlin'):EnergyWindow{
 const match=/^(\d{4})-(\d{2})$/.exec(month);if(!match)return energyWindow('month',now,zone);
 const y=Number(match[1]),m=Number(match[2]),today=wall(now,zone);if(m<1||m>12||y>today.year||(y===today.year&&m>=today.month))return energyWindow('month',now,zone);
 const start={year:y,month:m,day:1,hour:0,minute:0,second:0},end={...start,year:m===12?y+1:y,month:m===12?1:m+1},format=(w:Wall)=>new Intl.DateTimeFormat('de-DE',{timeZone:zone,month:'long',year:'numeric'}).format(instant(w,zone));
 return {start:instant(start,zone),end:instant(end,zone),priorStart:instant(prevYear(start),zone),priorEnd:instant(prevYear(end),zone),period:'day',zone,label:format(start),priorLabel:format(prevYear(start))};
}
export function energySources(prefs:unknown):EnergySources{const out:EnergySources={solar:[],import:[],export:[]};const rows=(prefs as {energy_sources?:unknown[]})?.energy_sources;if(!Array.isArray(rows))return out;
 const push=(kind:EnergyMetric,id:unknown)=>{if(typeof id==='string'&&id&&!out[kind].includes(id))out[kind].push(id);};
 for(const row of rows){if(!row||typeof row!=='object')continue;const r=row as Record<string,unknown>;if(r.type==='solar')push('solar',r.stat_energy_from);if(r.type==='grid'){push('import',r.stat_energy_from);push('export',r.stat_energy_to);for(const f of Array.isArray(r.flow_from)?r.flow_from:[])push('import',(f as {stat_energy_from?:string}).stat_energy_from);for(const f of Array.isArray(r.flow_to)?r.flow_to:[])push('export',(f as {stat_energy_to?:string}).stat_energy_to);}}
 return out;
}
/** A missing channel or bucket is unknown, never silently added as zero. */
export function energyBins(stats:EnergyStats,ids:readonly string[]):{start:number;value:number|null}[]{
 if(!ids.length)return [];const times=[...new Set(ids.flatMap(id=>(stats[id]??[]).map(p=>p.start)))].sort((a,b)=>a-b);return times.map(start=>{const values=ids.map(id=>stats[id]?.find(p=>p.start===start)?.change);return {start,value:values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)?(values as number[]).reduce((a,b)=>a+b,0):null};});
}
export function energyTotal(bins:{value:number|null}[]):number|null{return !bins.length||bins.some(b=>b.value===null)?null:bins.reduce((n,b)=>n+b.value!,0);}
export async function fetchEnergyComparison(h:Pick<HomeAssistant,'callWS'>,window:EnergyWindow,sources:EnergySources){const ids=[...new Set(Object.values(sources).flat())];if(!ids.length)return {current:{} as EnergyStats,prior:{} as EnergyStats};const query=(start:number,end:number)=>end<=start?Promise.resolve({} as EnergyStats):h.callWS<EnergyStats>({type:'recorder/statistics_during_period',start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),statistic_ids:ids,period:window.period,units:{energy:'kWh'},types:['change']});const [current,prior]=await Promise.all([query(window.start,window.end),query(window.priorStart,window.priorEnd)]);const bounded=(stats:EnergyStats,start:number,end:number):EnergyStats=>Object.fromEntries(Object.entries(stats).map(([id,rows])=>[id,rows.filter(r=>r.start>=start&&r.start<end&&(r.end===undefined||r.end<=end))]));return {current:bounded(current,window.start,window.end),prior:bounded(prior,window.priorStart,window.priorEnd)};}

export function groupEnergyBins(bins:{start:number;value:number|null}[],key:(at:number)=>string){const grouped=new Map<string,number|null>();for(const p of bins){const k=key(p.start),before=grouped.get(k);grouped.set(k,p.value===null||before===null?null:(before??0)+p.value);}return grouped;}

/** Calendar day selection uses local midnights, so DST days may contain 23 or 25 hours. */
export function energyDateKey(now:number,zone='Europe/Berlin'){const w=wall(now,zone);return `${w.year}-${String(w.month).padStart(2,'0')}-${String(w.day).padStart(2,'0')}`;}
export function energyShiftDate(date:string,delta:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
export function energyDayWindow(date:string,now:number,zone='Europe/Berlin'):EnergyWindow{
 const today=energyDateKey(now,zone),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);if(!match||date>=today)return energyWindow('day',now,zone);
 const y=+match[1],m=+match[2],d=+match[3],check=new Date(Date.UTC(y,m-1,d));if(check.toISOString().slice(0,10)!==date)return energyWindow('day',now,zone);
 const start={year:y,month:m,day:d,hour:0,minute:0,second:0},next=(w:Wall)=>{const n=new Date(Date.UTC(w.year,w.month-1,w.day+1));return {...w,year:n.getUTCFullYear(),month:n.getUTCMonth()+1,day:n.getUTCDate()};},prior=prevYear(start),format=(w:Wall)=>new Intl.DateTimeFormat('de-DE',{timeZone:zone,day:'numeric',month:'long',year:'numeric'}).format(instant(w,zone));
 return {start:instant(start,zone),end:instant(next(start),zone),priorStart:instant(prior,zone),priorEnd:instant(next(prior),zone),period:'hour',zone,label:format(start),priorLabel:format(prior)};
}
