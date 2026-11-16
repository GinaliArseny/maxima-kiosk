import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './data/DataProvider';
import { ExternalLinkProvider } from './external/ExternalLinkProvider';
import { IdleReset } from './kiosk/IdleReset';
import { KioskShell } from './kiosk/KioskShell';
import { DocRoute } from './pdf/DocRoute';
import { Contacts } from './screens/Contacts';
import { DoctorCard } from './screens/DoctorCard';
import { Doctors } from './screens/Doctors';
import { Documents } from './screens/Documents';
import { Home } from './screens/Home';
import { Rights } from './screens/Rights';

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
              <Route path="/documents" element={<Documents />} />
              <Route path="/rights" element={<Rights />} />
              <Route path="/doctors" element={<Doctors />} />
              <Route path="/doctors/:id" element={<DoctorCard />} />
              <Route path="/doc/:id" element={<DocRoute />} />
            </Routes>
          </KioskShell>
        </ExternalLinkProvider>
      </HashRouter>
    </DataProvider>
  );
}
