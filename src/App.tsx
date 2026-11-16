import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './data/DataProvider';
import { KioskShell } from './kiosk/KioskShell';
import { ScreenLayout } from './ui/ScreenLayout';

function Home() {
  return <h1>Добро пожаловать</h1>;
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <KioskShell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/documents" element={<ScreenLayout title="Документы и сведения">{null}</ScreenLayout>} />
          </Routes>
        </KioskShell>
      </HashRouter>
    </DataProvider>
  );
}
