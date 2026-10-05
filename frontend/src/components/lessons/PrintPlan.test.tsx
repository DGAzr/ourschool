import {render,screen,cleanup,within} from '@testing-library/react'
import {afterEach,describe,it,expect} from 'vitest'
import PrintPlan from './PrintPlan'
import {Lesson} from '../../types/lesson'
const lesson={id:771,title:'Explore a creek',date:'2026-10-05',position:0,status:'planned',objective:'Notice living things',notes:'PRIVATE teacher reminder',students:[{id:22,first_name:'Sam'}],materials:[{label:'Notebook'}],resources:[],templates:[],paperless_materials:[]} as unknown as Lesson
afterEach(cleanup)
describe('family learning plan',()=>{
  it('prints named students and required materials without private notes or internal IDs',()=>{
    render(<PrintPlan lessons={[lesson]} teacherCopy={false} schoolName="River School" />)
    expect(screen.getByText('River School · Learning plan')).toBeInTheDocument()
    expect(screen.getByText('Students: Sam')).toBeInTheDocument()
    expect(screen.getByText('Materials: Notebook')).toBeInTheDocument()
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument()
    expect(document.querySelector('.school-plan-print')?.textContent).not.toContain('771')
  })
  it('only includes private teacher notes by explicit choice',()=>{
    render(<PrintPlan lessons={[lesson]} teacherCopy schoolName="River School" />)
    expect(screen.getByText('Teacher notes:')).toBeInTheDocument()
    expect(screen.getByText('PRIVATE teacher reminder')).toBeInTheDocument()
  })
  it('renders objectives and activity instructions as formatted Markdown',()=>{
    const formattedLesson: Lesson = {
      ...lesson,
      objective: '## Observe the creek\n\nNotice **living things** and *their habitats*.\n\n- Bring a notebook\n- Sketch a leaf',
      templates: [{
        id: 8,
        template: {id: 9,name:'Creek observations',assignment_type:'project',max_points:10,subject_id:1},
        custom_instructions: '1. Visit the [field guide](https://example.com/guide).\n2. Record `three` observations.\n\n> Work carefully.\n\n| Find | Count |\n| --- | --- |\n| Leaves | 3 |\n\n- [x] Notebook ready\n- [ ] Observe wildlife\n\n```text\nWater temperature: 15 C\n```',
      }],
    }
    render(<PrintPlan lessons={[formattedLesson]} teacherCopy={false} />)
    const article = document.querySelector('.school-plan-print article')!
    const content = within(article as HTMLElement)
    expect(content.getByRole('heading',{name:'Observe the creek',level:2,hidden:true})).toBeInTheDocument()
    expect(content.getByText('living things').tagName).toBe('STRONG')
    expect(content.getByText('their habitats').tagName).toBe('EM')
    expect(content.getByText('Bring a notebook').closest('ul')).toBeInTheDocument()
    expect(content.getByRole('link',{name:'field guide',hidden:true})).toHaveAttribute('href','https://example.com/guide')
    expect(content.getByRole('link',{name:'field guide',hidden:true}).closest('ol')).toBeInTheDocument()
    expect(content.getByText('three').tagName).toBe('CODE')
    expect(content.getByText('Work carefully.').closest('blockquote')).toBeInTheDocument()
    expect(content.getByRole('table',{hidden:true})).toBeInTheDocument()
    expect(content.getByRole('cell',{name:'Leaves',hidden:true})).toBeInTheDocument()
    const checkboxes = content.getAllByRole('checkbox',{hidden:true})
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes.every(checkbox => checkbox.hasAttribute('disabled'))).toBe(true)
    expect(content.getByText('Water temperature: 15 C').closest('pre')).toBeInTheDocument()
    expect(article.textContent).not.toContain('## Observe')
    expect(article.textContent).not.toContain('**living things**')
    expect(article.textContent).not.toContain('[field guide]')
  })
  it('formats private notes only on the teacher copy',()=>{
    const privateLesson = {...lesson,notes:'### Teacher reminder\n\n**PRIVATE** reminder\n\n- Prepare the answer key'}
    const view = render(<PrintPlan lessons={[privateLesson]} teacherCopy={false} />)
    expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument()
    expect(screen.queryByText('Prepare the answer key')).not.toBeInTheDocument()
    view.rerender(<PrintPlan lessons={[privateLesson]} teacherCopy />)
    expect(screen.getByRole('heading',{name:'Teacher reminder',level:3,hidden:true})).toBeInTheDocument()
    expect(screen.getByText('PRIVATE').tagName).toBe('STRONG')
    expect(screen.getByText('Prepare the answer key').closest('ul')).toBeInTheDocument()
  })
  it('uses the shared renderer to avoid executable HTML and unsafe Markdown links',()=>{
    render(<PrintPlan lessons={[{...lesson,objective:'<script>alert("unsafe")</script>\n\n[Unsafe link](javascript:alert%281%29)\n\n**Safe text**'}]} teacherCopy={false} />)
    const article = document.querySelector('.school-plan-print article')!
    expect(article.querySelector('script')).toBeNull()
    expect(screen.getByText('Unsafe link').closest('a')).not.toHaveAttribute('href')
    expect(screen.getByText('Safe text').tagName).toBe('STRONG')
  })
})
