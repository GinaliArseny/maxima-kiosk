import { Navigate, useParams } from 'react-router-dom';
import { useKioskData } from '../data/DataProvider';
import { PdfViewer } from './PdfViewer';

/** /doc/:id — ищет pdf-элемент во всех секциях; неизвестный id → экран документов. */
export function DocRoute() {
  const { id } = useParams();
  const item = useKioskData()
    .sections.flatMap((s) => s.items)
    .find((i) => i.id === id && i.kind === 'pdf');
  if (!item || item.kind !== 'pdf') return <Navigate to="/documents" replace />;
  return <PdfViewer key={item.id} url={`docs/${item.file}`} title={item.title} />;
}
