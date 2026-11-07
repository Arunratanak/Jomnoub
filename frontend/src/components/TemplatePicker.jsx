import { CheckIcon } from './Icons';

function Option({ value, selected, onChange, name, note }) {
  return (
    <label className={`template-option${selected ? ' selected' : ''}`}>
      <input
        type="radio"
        className="sr-only"
        name="template"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      <span className="template-text">
        <span className="template-name">{name}</span>
        <small className="muted">{note}</small>
      </span>
      {selected && <CheckIcon size={18} />}
    </label>
  );
}

// How a new project starts: empty, or with a template's tasks. '' means empty.
export default function TemplatePicker({ templates, value, onChange, labelledBy }) {
  const chosen = templates.find((t) => t.id === value);

  return (
    <>
      <div className="template-picker" role="radiogroup" aria-labelledby={labelledBy}>
        <Option value="" selected={value === ''} onChange={onChange} name="Empty project" note="Add your own tasks" />
        {templates.map((t) => (
          <Option
            key={t.id}
            value={t.id}
            selected={value === t.id}
            onChange={onChange}
            name={t.name}
            note={`${t.tasks.length} tasks · ${t.description}`}
          />
        ))}
      </div>
      {chosen && (
        <div className="template-preview">
          <small className="muted">These tasks will be added, unassigned. You can change them afterwards.</small>
          <ol>
            {chosen.tasks.map((title) => <li key={title}>{title}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}
