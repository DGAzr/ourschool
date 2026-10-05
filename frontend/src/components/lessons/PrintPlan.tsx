import { createPortal } from 'react-dom'
import { Lesson } from '../../types/lesson'
import { formatDateOnly } from '../../utils/formatters'

export default function PrintPlan({lessons,teacherCopy,schoolName='OurSchool',logo}: {lessons:Lesson[];teacherCopy:boolean;schoolName?:string;logo?:string}) {
  return createPortal(<section className="school-plan-print">
    <style>{`@media screen {.school-plan-print{display:none}} @media print {body> :not(.school-plan-print){display:none!important}body{overflow:visible!important}.school-plan-print{display:block;color:#111;background:white;font:12pt Georgia,serif;overflow-wrap:anywhere}.school-plan-print article{break-inside:avoid;margin:0 0 18pt;padding:12pt;border:1px solid #aaa}.school-plan-print h1{font-size:22pt}.school-plan-print h2{font-size:15pt;margin:4pt 0}.school-plan-print p{margin:6pt 0}.school-plan-print img{max-height:60pt;max-width:180pt}.school-plan-print .notes-lines{height:38pt;border-top:1px solid #aaa;border-bottom:1px solid #aaa}@page{margin:.6in}}`}</style>
    {logo && <img src={logo} alt={`${schoolName} logo`} />}<h1>{schoolName} · Learning plan</h1><p>{teacherCopy ? 'Teacher copy' : 'Student copy'}</p>
    {[...lessons].sort((a,b)=>(a.date??'').localeCompare(b.date??'') || a.position-b.position).map(lesson => <article key={lesson.id}>
      <p>{formatDateOnly(lesson.date ?? undefined)} · {lesson.subject?.name ?? 'Learning'} · {lesson.status === 'taught' ? 'Taught' : 'Planned'}</p>
      <h2>{lesson.title}</h2><p>Students: {lesson.students.map(s=>s.first_name).join(', ') || 'Whole family'}</p>
      {lesson.objective && <p>Objective: {lesson.objective}</p>}
      {lesson.templates.length>0 && <><strong>Activities</strong><ul>{lesson.templates.map(link=><li key={link.id}>{link.template?.name ?? 'Activity'}{link.custom_instructions ? ` — ${link.custom_instructions}` : ''}</li>)}</ul></>}
      <p>Materials: {[...lesson.materials.map(m=>m.label),...lesson.paperless_materials.map(m=>m.title)].join(', ') || 'None needed'}</p>
      {lesson.resources.length>0 && <ul>{lesson.resources.map(r=><li key={r.id}>{r.label}{r.url ? `: ${r.url}` : ''}</li>)}</ul>}
      {teacherCopy && lesson.notes && <p>Teacher notes: {lesson.notes}</p>}
      <p>Notes:</p><div className="notes-lines" />
    </article>)}
  </section>,document.body)
}
