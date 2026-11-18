'use client';
import { useEffect, useRef } from 'react';
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Table2 } from 'lucide-react';

export function RichTextInput({value,onChange,label,placeholder}:{value:string;onChange:(value:string)=>void;label:string;placeholder?:string}){
  const editor=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(editor.current)editor.current.innerHTML=value||''},[]);
  function command(name:string,arg?:string){
    editor.current?.focus();
    if(name==='createLink'){
      const url=window.prompt('Enter the full link URL (https://…)');
      if(!url)return;
      try{const parsed=new URL(url);if(!['https:','http:','mailto:'].includes(parsed.protocol))return}catch{return}
      document.execCommand(name,false,url);
    }else if(name==='insertHTML')document.execCommand(name,false,arg||'');
    else document.execCommand(name,false,arg);
    if(editor.current)onChange(editor.current.innerHTML);
  }
  return <div className="rich-field"><div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
    <button type="button" title="Bold" aria-label="Bold" onMouseDown={e=>e.preventDefault()} onClick={()=>command('bold')}><Bold/></button>
    <button type="button" title="Italic" aria-label="Italic" onMouseDown={e=>e.preventDefault()} onClick={()=>command('italic')}><Italic/></button>
    <button type="button" title="Heading" aria-label="Heading" onMouseDown={e=>e.preventDefault()} onClick={()=>command('formatBlock','h2')}><Heading2/></button>
    <button type="button" title="Bulleted list" aria-label="Bulleted list" onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertUnorderedList')}><List/></button>
    <button type="button" title="Numbered list" aria-label="Numbered list" onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertOrderedList')}><ListOrdered/></button>
    <button type="button" title="Quote" aria-label="Block quote" onMouseDown={e=>e.preventDefault()} onClick={()=>command('formatBlock','blockquote')}><Quote/></button>
    <button type="button" title="Add link" aria-label="Add link" onMouseDown={e=>e.preventDefault()} onClick={()=>command('createLink')}><Link2/></button>
    <button type="button" title="Insert table" aria-label="Insert table" onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertHTML','<table><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>')}><Table2/></button>
  </div><div ref={editor} className="rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} data-placeholder={placeholder||'Write or paste content here…'} onInput={e=>onChange(e.currentTarget.innerHTML)}/><div className="rich-foot">Formatted content · links and markup are sanitized before saving</div></div>
}
