import React from 'react';
import { BellIcon, Bars3Icon } from '@heroicons/react/24/outline';

interface HeaderProps {
    tallerName: string;
    onMenuClick?: () => void;
    showMenuButton?: boolean;
}

const Header: React.FC<HeaderProps> = ({ tallerName, onMenuClick, showMenuButton }) => {
    return (
        <header className="h-20 flex items-center justify-between px-4 md:px-6 bg-white shadow-md z-10 flex-shrink-0">
            <div className="flex items-center gap-4">
                 {showMenuButton && (
                    <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 text-taller-gray hover:text-taller-dark">
                        <Bars3Icon className="h-6 w-6" />
                    </button>
                )}
                <h2 className="text-xl md:text-2xl font-semibold text-taller-dark">{tallerName}</h2>
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
