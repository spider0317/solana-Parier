import React from "react";
import { Link } from "react-router-dom";
import { ParierLogo } from "../svgs";
import './top-nav.scss';

const TopNav = () => {
    const links = [
        { title: 'Assets', uri: '/' },
        { title: 'My Bets', uri: '/my-bets' }
    ]

    return (<>
        <Link to={'/'} key={'logo'}>
            <div className="w-32 absolute left-16 top-8 cursor-pointer hover:scale-110 transform ease-in-out duration-200 ">
                <ParierLogo />
            </div>
        </Link>
        <div className="flex justify-center">
            {links.map(link => {
                return (
                    <Link to={link.uri} key={link.uri}>
                        <div className="flex-1 p-6 top-nav-item">
                            <p className="text-md font-medium text-slate-200">{link.title}</p>
                        </div>
                    </Link>)
            })}
        </div>
    </>)
}

export default TopNav;