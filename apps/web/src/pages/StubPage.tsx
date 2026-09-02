import { Body1, Title3 } from "@fluentui/react-components";

export function StubPage({ title, form, detail }: { title: string; form: string; detail: string }) {
  return (
    <div>
      <Title3>{title}</Title3>
      <Body1>
        Module prévu (phase suivante). Form Access : <b>{form}</b>.
      </Body1>
      <p>{detail}</p>
      <p>Cette route est volontairement un état vide pour ne pas inventer de règles métier hors du handoff.</p>
    </div>
  );
}
