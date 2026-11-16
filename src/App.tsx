import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './data/DataProvider';
import { ExternalLinkProvider } from './external/ExternalLinkProvider';
import { IdleReset } from './kiosk/IdleReset';
import { KioskShell } from './kiosk/KioskShell';
import { Contacts } from './screens/Contacts';
import { Home } from './screens/Home';
import { ScreenLayout } from './ui/ScreenLayout';

export default function App() {
  return (
    <DataProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ExternalLinkProvider>
          <IdleReset />
          <KioskShell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/documents" element={<ScreenLayout title="Документы и сведения">{null}</ScreenLayout>} />
            </Routes>
          </KioskShell>
        </ExternalLinkProvider>
      </HashRouter>
    </DataProvider>
  );
}
