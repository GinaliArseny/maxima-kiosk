import { Navigate, useParams } from 'react-router-dom';
import { useKioskData } from '../data/DataProvider';
import type { Tone } from '../ui/tone';
import { PdfViewer } from './PdfViewer';

/** /doc/:id — ищет pdf-элемент во всех секциях; неизвестный id → экран документов. */
export function DocRoute() {
  const { id } = useParams();
  const { sections, clinic } = useKioskData();
  const section = sections.find((s) => s.items.some((i) => i.id === id && i.kind === 'pdf'));
  const item = section?.items.find((i) => i.id === id);
  if (!section || !item || item.kind !== 'pdf') return <Navigate to="/documents" replace />;
  const tone: Tone = id === clinic.priceDocId ? 'lime' : section.screen === 'rights' ? 'purple' : 'orange';
  return <PdfViewer key={item.id} url={`docs/${item.file}`} title={item.title} tone={tone} />;
}
