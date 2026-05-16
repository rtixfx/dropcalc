/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './Landing';
import DropMap from './DropMap';
import { CookieConsent } from './components/CookieConsent';
import BlogsList from './pages/blogs/BlogsList';
import BlogPost from './pages/blogs/BlogPost';
import BlogEditor from './pages/blogs/BlogEditor';

export default function App() {
  return (
    <BrowserRouter>
      <CookieConsent />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<DropMap />} />
        <Route path="/blogs" element={<BlogsList />} />
        <Route path="/blogs/new" element={<BlogEditor />} />
        <Route path="/blogs/:id/edit" element={<BlogEditor />} />
        <Route path="/blogs/:slug" element={<BlogPost />} />
      </Routes>
    </BrowserRouter>
  );
}
