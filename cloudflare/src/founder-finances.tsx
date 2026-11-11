import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {ArrowDownRight,Download,FileText,RotateCcw} from 'lucide-react';
import {emptyFinancialInputs,evaluateFinancialScenario,financialScenarioSummary,type FinancialInputs,type FinancialInputKey,type FinancialScenarioResult} from '../shared/founder-finances.js';
import './founder-finances.css';

export type FounderFinancesProps={
  inputs:FinancialInputs;
  onChange:(next:FinancialInputs)=>void;
  onAppend:(summary:string)=>void|Promise<void>;
  disabled?:boolean;
  contextChanged?:boolean;
  onAdoptContext?:()=>void;
};

const fieldNames:Record<FinancialInputKey,string>={
  openingCash:'Available cash at the start',startupPayments:'Startup payments',
  monthlyReceipts:'Customer cash received each month',monthlyPayments:'Operating cash paid each month',
  months:'Months to compare',receiptsReduction:'Lower customer receipts',paymentsIncrease:'Higher operating payments',
  receiptDelay:'Delay before customer receipts begin',evidenceNote:'Evidence and uncertainties',
};
const money=(pence:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(pence/100);
const compactMoney=(pence:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(pence/100);
const monthLabel=(month:number|null,horizon:number)=>month===null?`None within ${horizon} months`:month===0?'Month 0 · after startup payments':`Month ${month}`;

function ScenarioCard({title,scenario,horizon,downside=false}:{title:string;scenario:FinancialScenarioResult;horizon:number;downside?:boolean}){
  return <article className={'founder-finance-result'+(downside?' downside':'')}>
    <h5>{title}</h5><p className="founder-finance-closing-label">Cash at the end of month {horizon}</p>
    <strong className={'founder-finance-amount'+(scenario.closing_balance<0?' negative':'')}>{money(scenario.closing_balance)}</strong>
    <dl><div><dt>Lowest shown balance</dt><dd>{money(scenario.minimum_balance)}</dd></div>
      <div><dt>First balance below zero</dt><dd>{monthLabel(scenario.first_negative_month,horizon)}</dd></div>
      <div><dt>First balance exactly zero</dt><dd>{monthLabel(scenario.first_zero_month,horizon)}</dd></div></dl>
  </article>;
}

function CashChart({base,downside,id}:{base:FinancialScenarioResult;downside:FinancialScenarioResult;id:string}){
  const balances=[0,...base.rows.map(row=>row.balance),...downside.rows.map(row=>row.balance)];
  let minimum=Math.min(...balances),maximum=Math.max(...balances);
  if(minimum===maximum){minimum-=100;maximum+=100;}
  const width=640,height=210,left=64,right=18,top=16,bottom=32,horizon=base.rows.length-1;
  const x=(month:number)=>left+month/horizon*(width-left-right);
  const y=(balance:number)=>top+(maximum-balance)/(maximum-minimum)*(height-top-bottom);
  const points=(scenario:FinancialScenarioResult)=>scenario.rows.map(row=>`${x(row.month)},${y(row.balance)}`).join(' ');
  return <figure className="founder-finance-chart">
    <figcaption><strong>Cash through the period</strong><span><i className="base" aria-hidden="true"/>Base <i className="downside" aria-hidden="true"/>Downside</span></figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={id+'-chart-title '+id+'-chart-description'}>
      <title id={id+'-chart-title'}>Base and downside month-end cash balances in pounds</title>
      <desc id={id+'-chart-description'}>Solid green is the base scenario; dashed copper is the downside. The horizontal zero line marks no remaining cash. Exact values and movements are in the month-by-month table below.</desc>
      <line className="grid" x1={left} x2={width-right} y1={top} y2={top}/>
      <line className="grid" x1={left} x2={width-right} y1={height-bottom} y2={height-bottom}/>
      <line className="zero" x1={left} x2={width-right} y1={y(0)} y2={y(0)}/>
      <text x={left-9} y={top+4} textAnchor="end">{compactMoney(maximum)}</text>
      <text x={left-9} y={height-bottom+4} textAnchor="end">{compactMoney(minimum)}</text>
      {minimum<0&&maximum>0&&<text x={left-9} y={y(0)+4} textAnchor="end">£0</text>}
      <polyline className="base" points={points(base)}/><polyline className="downside" points={points(downside)}/>
      <text x={left} y={height-8}>Month 0</text><text x={width-right} y={height-8} textAnchor="end">Month {horizon}</text>
    </svg>
    <p>Month 0 is after startup payments. Lines join monthly totals; they do not show the order of payments within a month.</p>
  </figure>;
}

export function FounderFinances({inputs,onChange,onAppend,disabled=false,contextChanged=false,onAdoptContext}:FounderFinancesProps){
  const id=useId(),inputKey=JSON.stringify(inputs),evaluation=useMemo(()=>evaluateFinancialScenario(inputs),[inputKey]);
  const[preview,setPreview]=useState<{inputKey:string;text:string;createdAt:number}|null>(null),[added,setAdded]=useState<string|null>(null);
  const[message,setMessage]=useState(''),[error,setError]=useState(''),[adding,setAdding]=useState(false),[confirmClear,setConfirmClear]=useState(false);
  const sending=useRef(false),clearTrigger=useRef<HTMLButtonElement>(null),clearConfirm=useRef<HTMLButtonElement>(null),previewRegion=useRef<HTMLDivElement>(null);
  const latest=useRef({inputKey,contextChanged,disabled});latest.current={inputKey,contextChanged,disabled};
  useEffect(()=>{setPreview(null);setAdded(null);setMessage('');setError('');},[inputKey]);
  useEffect(()=>{if(contextChanged){setPreview(null);setAdded(null);setMessage('');}},[contextChanged]);
  useEffect(()=>{if(confirmClear)clearConfirm.current?.focus();},[confirmClear]);
  const locked=disabled||adding||confirmClear,errors=evaluation.ok?{}:evaluation.errors;
  function update(key:FinancialInputKey,value:string){
    setError('');try{onChange({...inputs,[key]:value});}catch(e){setError(e instanceof Error?e.message:'The scenario could not be changed. Your previous inputs remain.');}
  }
  function input(key:FinancialInputKey,hint:string,unit:'GBP'|'%'|'months',integer=false){
    const errorText=errors[key],fieldId=id+'-'+key;
    return <label className="founder-finance-field" htmlFor={fieldId}>
      <strong>{fieldNames[key]}{unit==='GBP'?' · GBP':''}</strong><span id={fieldId+'-hint'}>{hint}</span>
      <span className="founder-finance-input">{unit==='GBP'&&<b aria-hidden="true">£</b>}<input id={fieldId} type="text" inputMode={integer?'numeric':'decimal'} autoComplete="off" required maxLength={32} value={inputs[key]} onChange={event=>update(key,event.target.value)} aria-invalid={errorText?true:undefined} aria-describedby={fieldId+'-hint'+(errorText?' '+fieldId+'-error':'')}/>{unit!=='GBP'&&<b aria-hidden="true">{unit}</b>}</span>
      {errorText&&<small id={fieldId+'-error'} className="founder-finance-field-error">{errorText}</small>}
    </label>;
  }
  function preparePreview(){
    setError('');setMessage('');
    try{const createdAt=Date.now();setPreview({inputKey,text:financialScenarioSummary(inputs,createdAt),createdAt});setAdded(null);requestAnimationFrame(()=>previewRegion.current?.focus());}
    catch(e){setError(e instanceof Error?e.message:'The summary could not be prepared. Check the inputs.');}
  }
  async function append(){
    if(sending.current||disabled||contextChanged||!preview||preview.inputKey!==inputKey||added===preview.text)return;
    const selected=preview;sending.current=true;setAdding(true);setError('');setMessage('');
    try{
      await onAppend(selected.text);
      if(latest.current.inputKey===selected.inputKey&&!latest.current.contextChanged&&!latest.current.disabled){setAdded(selected.text);setMessage('Scenario summary added to the current finance note. Account saving is a separate action.');}
      else setMessage('The earlier request completed. Check the finance note in the workbook you chose.');
    }catch(e){setError(e instanceof Error?e.message:'The summary could not be added. Check your finance note before trying again.');}
    finally{sending.current=false;setAdding(false);}
  }
  function downloadPreview(){
    if(disabled||adding||confirmClear||contextChanged||!preview||preview.inputKey!==inputKey)return;
    let url:string|undefined,anchor:HTMLAnchorElement|undefined;setError('');setMessage('');
    try{
      url=URL.createObjectURL(new Blob([preview.text],{type:'text/plain;charset=utf-8'}));
      anchor=document.createElement('a');anchor.href=url;anchor.download=`sponsor-intel-cash-scenario-${new Date(preview.createdAt).toISOString().slice(0,10)}.txt`;
      document.body.append(anchor);anchor.click();
      setMessage('Download requested. Check the text file in your downloads before closing this tab; it contains your private assumptions.');
    }catch{setError('The download could not be requested. The complete scenario note remains in the preview for you to copy.');}
    finally{anchor?.remove();if(url){const createdURL=url;setTimeout(()=>URL.revokeObjectURL(createdURL),30000);}}
  }
  function clear(){
    try{onChange(emptyFinancialInputs());setPreview(null);setAdded(null);setError('');setConfirmClear(false);setMessage('Scenario inputs cleared. Existing finance notes are unchanged.');requestAnimationFrame(()=>clearTrigger.current?.focus());}
    catch(e){setError(e instanceof Error?e.message:'The inputs could not be cleared.');}
  }
  const validPreview=!contextChanged&&preview?.inputKey===inputKey?preview:null;
  return <section className="founder-finances" aria-labelledby={id+'-title'}>
    <header className="founder-finance-heading"><div><p className="founder-finance-eyebrow">PUT NUMBERS BESIDE YOUR ASSUMPTIONS</p><h4 id={id+'-title'}>Your business cash plan</h4><p>See how cash changes month by month, then compare a tougher set of assumptions.</p></div><span className="founder-finance-currency">GBP</span></header>
    <p className="founder-finance-boundary">This browser tab keeps each signed-in account’s scenario separate; switching accounts hides the other account’s inputs. Closing or reloading loses these inputs. A workbook export carries any summary you explicitly add to the finance note, not an editable scenario.</p>
    {contextChanged&&<div className="founder-finance-context" role="status"><strong>The workbook has changed.</strong><p>Your scenario inputs are retained. Choose whether to use them with the current workbook before adding a summary.</p><button type="button" disabled={disabled||adding||!onAdoptContext} onClick={()=>{setError('');try{onAdoptContext?.();}catch(e){setError(e instanceof Error?e.message:'The current workbook could not be selected.');}}}>Use with current workbook</button></div>}
    {disabled&&<p className="founder-finance-context" role="status">The workbook is unavailable for editing. Your scenario remains visible.</p>}
    <fieldset className="founder-finance-fields" disabled={locked}><legend>1. Your base assumptions</legend><p>Use cash actually available at the start. Leave future funding out of that amount. Enter 0 where you deliberately assume no payment or receipt; a blank is unknown.</p>
      <div className="founder-finance-input-grid">
        {input('openingCash','Money available to this business now.','GBP')}
        {input('startupPayments','One-off payments taken out at month 0.','GBP')}
        {input('monthlyReceipts','Cash customers pay, rather than invoices raised.','GBP')}
        {input('monthlyPayments','Include the operating payments you expect to make.','GBP')}
        {input('months','Choose a period from 1 to 36 months.','months',true)}
      </div>
    </fieldset>
    <fieldset className="founder-finance-fields downside" disabled={locked}><legend>2. Try a downside</legend><p>Change recurring cash flows while keeping the same opening cash and startup payments. Enter 0 for a change you do not want to apply.</p><div className="founder-finance-input-grid">
      {input('receiptsReduction','Reduce monthly customer receipts by 0–100%.','%')}
      {input('paymentsIncrease','Increase monthly operating payments by 0–200%.','%')}
      {input('receiptDelay','No customer receipts during these first months. Afterward, reduced receipts start without catch-up.','months',true)}
    </div></fieldset>
    <fieldset className="founder-finance-fields evidence" disabled={locked}><legend>3. Record what supports the numbers</legend><label className="founder-finance-field" htmlFor={id+'-evidenceNote'}><strong>Evidence and uncertainties <span className="founder-finance-optional">· optional</span></strong><span id={id+'-evidence-hint'}>One line, up to 600 characters. Note the source, date and any untested assumption. Leave out names, account details and private customer information.</span><input id={id+'-evidenceNote'} type="text" maxLength={600} value={inputs.evidenceNote} onChange={event=>update('evidenceNote',event.target.value)} aria-invalid={errors.evidenceNote?true:undefined} aria-describedby={id+'-evidence-hint'+(errors.evidenceNote?' '+id+'-evidence-error':'')}/>{errors.evidenceNote&&<small id={id+'-evidence-error'} className="founder-finance-field-error">{errors.evidenceNote}</small>}</label></fieldset>
    {!evaluation.ok&&<div className="founder-finance-incomplete" role={Object.keys(errors).length?'alert':'status'}>{evaluation.missing.length>0&&<p><strong>{evaluation.missing.length} input{evaluation.missing.length===1?'':'s'} still needed.</strong> Complete {evaluation.missing.map(key=>fieldNames[key].toLowerCase()).join(', ')} to see the comparison.</p>}{Object.keys(errors).length>0&&<><strong>Check the highlighted inputs.</strong>{errors._input&&<p>{errors._input}</p>}</>}</div>}
    {evaluation.ok&&<div className="founder-finance-comparison" aria-labelledby={id+'-comparison'}><h4 id={id+'-comparison'}>What these assumptions produce</h4><p className="founder-finance-method">Constant monthly amounts, calculated to the penny. This does not predict customer demand or establish business, funding or visa outcomes. Add omitted costs to your assumptions; no tax, interest or new funding is calculated automatically.</p><div className="founder-finance-results"><ScenarioCard title="Base assumptions" scenario={evaluation.base} horizon={Number(evaluation.inputs.months)}/><ScenarioCard title="Downside assumptions" scenario={evaluation.downside} horizon={Number(evaluation.inputs.months)} downside/></div>
      <CashChart base={evaluation.base} downside={evaluation.downside} id={id}/>
      <details className="founder-finance-months"><summary>Month-by-month cash movements <span>GBP · exact amounts</span></summary><div className="founder-finance-table" tabIndex={0} role="region" aria-label="Scrollable base and downside cash movements"><table><caption>Month 0 includes startup payments. Later rows show cash received, cash paid and the resulting month-end balance.</caption><thead><tr><th rowSpan={2} scope="col">Month</th><th colSpan={3} scope="colgroup">Base</th><th colSpan={3} scope="colgroup">Downside</th></tr><tr>{['Received','Paid','Balance','Received','Paid','Balance'].map((label,index)=><th key={index} scope="col">{label}</th>)}</tr></thead><tbody>{evaluation.base.rows.map((row,index)=>{const other=evaluation.downside.rows[index];return <tr key={row.month}><th scope="row">{row.month===0?'0 · startup':row.month}</th>{[row.receipts,row.payments,row.balance,other.receipts,other.payments,other.balance].map((value,column)=><td key={column} className={value<0?'negative':undefined}>{money(value)}</td>)}</tr>;})}</tbody></table></div></details>
    </div>}
    <div className="founder-finance-actions"><button type="button" className="founder-finance-preview-button" disabled={locked||!evaluation.ok||contextChanged} onClick={preparePreview}><FileText size={16}/>Preview dated finance note</button><button type="button" ref={clearTrigger} disabled={disabled||adding||confirmClear} onClick={()=>setConfirmClear(true)}><RotateCcw size={15}/>Clear scenario inputs</button></div>
    {confirmClear&&<div className="founder-finance-context" role="group" aria-labelledby={id+'-clear-title'}><strong id={id+'-clear-title'}>Clear these scenario inputs?</strong><p>The amounts and evidence note will be cleared, and the period will return to 12 months. Existing workbook notes and exports will keep their text.</p><button type="button" ref={clearConfirm} disabled={disabled||adding} onClick={clear}>Clear inputs</button><button type="button" onClick={()=>{setConfirmClear(false);requestAnimationFrame(()=>clearTrigger.current?.focus());}}>Keep my inputs</button></div>}
    {validPreview&&<div ref={previewRegion} tabIndex={-1} className="founder-finance-preview" aria-labelledby={id+'-preview-title'}><h5 id={id+'-preview-title'}>The exact note to add</h5><p>The generated date records this calculation. It does not renew any supporting evidence.</p><pre tabIndex={0} aria-label="Exact dated scenario summary">{validPreview.text}</pre><div className="founder-finance-preview-actions"><button type="button" className="founder-finance-append" disabled={disabled||adding||contextChanged||confirmClear||added===validPreview.text} onClick={()=>void append()}><ArrowDownRight size={17}/>{adding?'Adding summary…':added===validPreview.text?'Summary added to finance note':'Add scenario to finance note'}</button><button type="button" disabled={disabled||adding||contextChanged||confirmClear} onClick={downloadPreview}><Download size={16}/>Download scenario note</button></div></div>}
    {message&&!contextChanged&&<p className="founder-finance-feedback" role="status">{message}</p>}{error&&<p className="founder-finance-error" role="alert">{error}</p>}
  </section>;
}
