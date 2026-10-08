import { Link, NavLink } from 'react-router-dom';

export function Navbar() {
    return (
        <nav className="navbar">
            <Link to="/" className="brand">
                Liam Walke
            </Link>
            <div className="nav-links">
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/projects">Projects</NavLink>
                <NavLink to="/about">About</NavLink>
                <NavLink to="/ai">AI Statement</NavLink>
            </div>
        </nav>
    );
}