import React from 'react'
import {Show, SignInButton, useAuth, UserButton} from "@clerk/react"
import {useQuery} from "@tanstack/react-query";
import { apiFetch } from '../lib/api';
import {Link} from "react-router";

import {
    LogInIcon,
    PackageIcon,
    SettingsIcon,
    ShoppingBagIcon,
    ShoppingCartIcon,
    StoreIcon,
} from "lucide-react";
import { useCartStore } from '../store/cart';


const Navbar = () => {

    const {getToken, isSignedIn} = useAuth();

    const {data} = useQuery({
        queryKey: ["user"],
        queryFn: () => apiFetch("/api/me", {getToken}),
        enabled: isSignedIn,
    })

    const role = data?.user?.role;
    const cartItemCount = useCartStore(state => state.items.reduce((total, item) => total + item.quantity, 0));


  return (
    <header className="sticky top-0 z-50 border-b border-base-300 bg-base-100/95 shadow-sm backdrop-blur-md">
        <div className="navbar mx-auto min-h-14 max-w-7xl px-4 py-2.5 md:px-6 md:py-3">
            <div className="flex-1">
                <Link
                    to="/"
                    className="btn btn-ghost gap-2 px-2 font-mono text-lg font=semibond uppercase tracking-wide md:text-xl">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-primar/15 p-1 text-primary">
                            <StoreIcon className="size-8" area-hidden/>
                        </span>
                        <span className="leading-none">NextCart</span>
                </Link>
            </div>

            <nav className="flex items-center gap-1 md:gap-1.5">
                <Link to="/" className='btn btn-ghost gap-2 font-medium'>
                    <ShoppingBagIcon className="size-6" area-hidden/>
                    <span className="hidden sm:inline">Shop</span>
                </Link>

                <Show when={"signed-in"}>
                    <Link to="/orders" className='btn btn-ghost gap-2 font-medium'>
                        <PackageIcon className="size-6" area-hidden/>
                        <span className="hidden sm:inline">Orders</span>
                    </Link>

                    {role === "admin" ? (
                        <Link to="/admin" className='btn btn-ghost gap-2 font-medium'>
                            <SettingsIcon className="size-6" area-hidden/>
                            <span className="hidden sm:inline">Admin</span>
                        </Link>
                    ) : null}

                </Show>

                <Link to="/cart" className='btn btn-ghost gap-2 font-medium indicator'
                area-label={cartItemCount > 0 ? `Cart ${cartItemCount} items` : "Cart"}>

                    {cartItemCount > 0  ? (
                        <span className="indicator-item badge badge-sm badge-primary min-w-2 px-1.5
                        font-sans text-xs tabular-nums">{
                            cartItemCount > 99 ? "99+" : cartItemCount
                        }</span>
                    ) : null}
                    <ShoppingCartIcon className="size-6" area-hidden/>
                    <span className="hidden sm:inline">Cart</span>
                </Link>

                
                
                <Show when={"signed-out"}>
                    <SignInButton mode="modal">
                        <button className='btn btn-primary btn-sm gap-1.5 px-3 shadow-md'>
                            <LogInIcon className="size-4 drop-shadow-sm" area-hidden/>
                            <span className="hidden sm:inline">Sign In</span>
                        </button>
                    </SignInButton>
                </Show>

                <Show when={"signed-in"}>
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                        <UserButton 
                            appearance={{elements: {avatarBox: "h-10 w-10 ring-2 ring-base-300"}}}
                        />
                            {role === "admin" ||  role === "support" ? (
                                <span className="badge badge-primary badge-sm hidden capitalize md:inline-flex">{role}</span>
                            ) : null}
                    </div>
                </Show>
            </nav>
        </div>
    </header>
  )
}

export default Navbar