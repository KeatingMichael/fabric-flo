import { Link } from "react-router-dom";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

export function LegalFooter() {
  return (
    <footer className="legal-footer muted">
      <Link to="/privacy">Privacy</Link>
      <span aria-hidden> · </span>
      <Link to="/terms">Terms</Link>
      <span aria-hidden> · </span>
      <Link to="/help">Help</Link>
      <span aria-hidden> · </span>
      <Link to="/licenses">Licenses</Link>
      <span className="legal-footer__version">v{APP_VERSION}</span>
    </footer>
  );
}
