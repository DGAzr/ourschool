import { createPortal } from 'react-dom'
import MarkdownRenderer from '../common/MarkdownRenderer'
import { Lesson } from '../../types/lesson'
import { formatDateOnly } from '../../utils/formatters'

export default function PrintPlan({lessons,teacherCopy,schoolName='OurSchool',logo}: {lessons:Lesson[];teacherCopy:boolean;schoolName?:string;logo?:string}) {
  return createPortal(<section className="school-plan-print">
    <style>{`
      @media screen {.school-plan-print{display:none}}
      @media print {
        body> :not(.school-plan-print){display:none!important}
        body{overflow:visible!important}
        .school-plan-print{display:block;color:#111;background:white;color-scheme:light;font:12pt Georgia,serif;overflow-wrap:anywhere}
        .school-plan-print article{break-inside:avoid;margin:0 0 18pt;padding:12pt;border:1px solid #aaa}
        .school-plan-print h1{font-size:22pt}
        .school-plan-print h2{font-size:15pt;margin:4pt 0}
        .school-plan-print p{margin:6pt 0}
        .school-plan-print img{max-height:60pt;max-width:180pt}
        .school-plan-print ul,.school-plan-print ol{list-style-position:outside;margin:6pt 0;padding-left:18pt}
        .school-plan-print ul{list-style-type:disc}
        .school-plan-print ol{list-style-type:decimal}
        .school-plan-print .plan-markdown{margin:6pt 0}
        .school-plan-print .plan-markdown *{color:inherit;background:transparent}
        .school-plan-print .plan-markdown h1{font-size:16pt}
        .school-plan-print .plan-markdown h2{font-size:14pt}
        .school-plan-print .plan-markdown h3{font-size:13pt}
        .school-plan-print .plan-markdown h4,.school-plan-print .plan-markdown h5,.school-plan-print .plan-markdown h6{font-size:12pt;font-weight:bold}
        .school-plan-print .plan-markdown h1,.school-plan-print .plan-markdown h2,.school-plan-print .plan-markdown h3,.school-plan-print .plan-markdown h4,.school-plan-print .plan-markdown h5,.school-plan-print .plan-markdown h6{margin:8pt 0 4pt;break-after:avoid}
        .school-plan-print .plan-markdown blockquote{border-left:2pt solid #aaa;padding:0 0 0 10pt;margin:8pt 0}
        .school-plan-print .plan-markdown div{overflow:visible}
        .school-plan-print .plan-markdown table{width:100%;min-width:0;border-collapse:collapse;margin:8pt 0}
        .school-plan-print .plan-markdown th,.school-plan-print .plan-markdown td{border:1px solid #aaa;padding:4pt;text-align:left;font-size:inherit}
        .school-plan-print .plan-markdown code{font-size:10pt;white-space:pre-wrap}
        .school-plan-print .plan-markdown pre{white-space:pre-wrap;overflow:visible;padding:6pt;border:1px solid #aaa}
        .school-plan-print .plan-markdown pre pre{padding:0;border:0;margin:0}
        .school-plan-print .notes-lines{height:38pt;border-top:1px solid #aaa;border-bottom:1px solid #aaa}
        @page{margin:.6in}
      }
    `}</style>
    {logo && <img src={logo} alt={`${schoolName} logo`} />}<h1>{schoolName} · Learning plan</h1><p>{teacherCopy ? 'Teacher copy' : 'Student copy'}</p>
    {[...lessons].sort((a,b)=>(a.date??'').localeCompare(b.date??'') || a.position-b.position).map(lesson => <article key={lesson.id}>
      <p>{formatDateOnly(lesson.date ?? undefined)} · {lesson.subject?.name ?? 'Learning'} · {lesson.status === 'taught' ? 'Taught' : 'Planned'}</p>
      <h2>{lesson.title}</h2><p>Students: {lesson.students.map(s=>s.first_name).join(', ') || 'Whole family'}</p>
      {lesson.objective && <div><strong>Objective:</strong><MarkdownRenderer content={lesson.objective} className="plan-markdown" /></div>}
      {lesson.templates.length>0 && <><strong>Activities</strong><ul>{lesson.templates.map(link=><li key={link.id}>{link.template?.name ?? 'Activity'}{link.custom_instructions && <MarkdownRenderer content={link.custom_instructions} className="plan-markdown" />}</li>)}</ul></>}
      <p>Materials: {[...lesson.materials.map(m=>m.label),...lesson.paperless_materials.map(m=>m.title)].join(', ') || 'None needed'}</p>
      {lesson.resources.length>0 && <ul>{lesson.resources.map(r=><li key={r.id}>{r.label}{r.url ? `: ${r.url}` : ''}</li>)}</ul>}
      {teacherCopy && lesson.notes && <div><strong>Teacher notes:</strong><MarkdownRenderer content={lesson.notes} className="plan-markdown" /></div>}
      <p>Notes:</p><div className="notes-lines" />
    </article>)}
  </section>,document.body)
}
