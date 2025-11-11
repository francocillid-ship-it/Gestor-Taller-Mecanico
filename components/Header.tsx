import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
    tallerName: string;
}

const Header: React.FC<HeaderProps> = ({ tallerName }) => {
    return (
        <header className="h-20 flex items-center justify-between px-6 bg-white shadow-md z-10 flex-shrink-0">
            <div>
                <h2 className="text-2xl font-semibold text-taller-dark">{tallerName}</h2>
            </div>
            <div className="flex items-center space-x-4">
                <button className="p-2 rounded-full hover:bg-taller-light focus:outline-none focus:ring-2 focus:ring-taller-primary">
                    <BellIcon className="h-6 w-6 text-taller-gray" />
                </button>
            </div>
        </header>
    );
};

export default Header;