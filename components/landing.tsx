import { ArrowRight,ArrowUpRight,CalendarRange,Check,CheckCircle2,GitBranch,Layers,Lock,ShieldCheck } from 'lucide-react';
import Brand from './brand';

const stages=[['SHOULD','Agree on the handoffs'],['CAN','Make the work ready'],['WILL','Commit with confidence'],['DID','Record what happened'],['LEARN','Build a better next week']];

export default function Landing({signedIn,onCreate,onLogin,onDemo}:{signedIn:boolean;onCreate:()=>void;onLogin:()=>void;onDemo:()=>void}){
 return <div className="landing">
  <header>
   <a className="brand" href="/" aria-label="LPS home"><Brand/><span>LEAN PROJECT DELIVERY</span></a>
   <nav aria-label="Main navigation"><a href="#how-it-works">The workflow</a><a href="#built-for-work">Inside LPS</a><button onClick={onLogin}>Sign in</button><button className="primary" onClick={onCreate}>Get started <ArrowUpRight size={16}/></button></nav>
  </header>
  <main>
   <section className="landinghero">
    <div className="herocopy">
     <div className="releasepill"><CheckCircle2 size={14}/> The Last Planner System® · Connected, end to end</div>
     <h1>Your plan.<br/><em>Reliable delivery.</em><br/>One connected system.</h1>
     <p>Make the work ready. Make a promise you can keep. Give your team one clear place to plan, deliver and learn.</p>
     <div className="actions"><button className="primary" onClick={onCreate}>{signedIn?'Create a project':'Start your workspace'}<ArrowRight size={18}/></button><button onClick={onDemo}>Explore the demo <ArrowUpRight size={17}/></button></div>
     <div className="landing-note"><Lock size={14}/>Private projects <span/>Daily quantity ledger <span/>Reliable promises</div>
    </div>
    <div className="systemvisual" aria-label="Illustration of a planning board moving ready activities into a weekly work plan">
     <div className="visualtop"><span className="visualsymbol"><Layers size={18}/></span><span>THE BIG ROOM</span><div><i/><i/><i/></div></div>
     <div className="visualheading"><div><small>SHOULD → CAN → WILL</small><h2>Everything in flow.</h2></div><span className="visualweek"><CalendarRange size={14}/>This week</span></div>
     <div className="visualboard">
      <div className="visualcolumn"><span>MAKE READY <b>02</b></span><div className="visualtask"><i className="violet"/><small>STRUCTURE</small><strong>Prepare the handoff</strong><p>Zone A · Trade lead</p><div><ShieldCheck size={13}/>Check constraints</div></div><div className="visualtask"><i className="yellow"/><small>MEP</small><strong>Clear the path</strong><p>Zone B · Design lead</p><div><GitBranch size={13}/>Confirm the sequence</div></div></div>
      <div className="visualcolumn"><span>WEEKLY PROMISES <b>01</b></span><div className="visualtask featured"><i className="green"/><small>READY TO COMMIT</small><strong>One reliable promise.</strong><p>A clear quantity, owner and due date.</p><div className="visualcheck"><Check size={14}/> Handoffs confirmed</div><div className="visualcheck"><Check size={14}/> Blockers removed</div><div className="visualcheck"><Check size={14}/> Scope agreed</div></div><div className="visuallearning"><span><CheckCircle2 size={18}/></span><div><strong>Keep improving.</strong><small>Learn from every week.</small></div><ArrowUpRight size={16}/></div></div>
     </div>
     <div className="visualfooter"><i/>A connected planning conversation<span>Illustrative workflow</span></div>
    </div>
   </section>
   <section id="how-it-works" className="workflowsection"><div className="sectioneyebrow">THE PLANNING CONVERSATION</div><div className="sectionheading"><h2>Five conversations.<br/><em>One reliable workflow.</em></h2><p>From the milestone to the daily huddle, keep every decision connected to the next handoff.</p></div><div className="hero-flow">{stages.map(([title,body],i)=><div key={title}><span>0{i+1}</span><strong>{title}</strong><small>{body}</small><ArrowRight size={18}/></div>)}</div></section>
   <section id="built-for-work" className="featuresection"><div className="sectioneyebrow">BUILT AROUND THE WORK</div><h2>Clarity at every level.</h2><div className="landingfeatures"><article><CalendarRange size={24}/><h3>Plan the real work.</h3><p>Connect milestones, activity scope, predecessor handoffs and your six-week lookahead.</p></article><article><ShieldCheck size={24}/><h3>Make it possible.</h3><p>Give every constraint an owner. Commit to work your team is ready to deliver.</p></article><article><CheckCircle2 size={24}/><h3>Measure it honestly.</h3><p>A daily ledger for quantities. Frozen promises for PPC. Useful learning from every miss.</p></article></div></section>
   <section className="landingcta"><div><div className="sectioneyebrow">YOUR NEXT PLANNING CONVERSATION</div><h2>Bring everyone into the big room.</h2></div><button className="primary" onClick={onDemo}>Explore LPS <ArrowUpRight size={18}/></button></section>
  </main>
  <footer><Brand/><p>Reliable work, one promise at a time.</p><small>Independent Last Planner System® application.</small></footer>
 </div>;
}
