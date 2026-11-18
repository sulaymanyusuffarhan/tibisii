import { notFound } from 'next/navigation';
import { ContentWorkspace } from '@/components/admin/ContentWorkspace';
const valid=new Set(['articles','pages','events','publications']);
export default async function ContentCollectionPage({params}:{params:Promise<{collection:string}>}){
 const {collection}=await params;if(!valid.has(collection))notFound();
 return <ContentWorkspace collection={collection as 'articles'|'pages'|'events'|'publications'}/>;
}
