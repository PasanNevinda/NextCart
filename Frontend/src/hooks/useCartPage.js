import {useAuth} from "@clerk/react";
import { useCartStore } from "../store/cart";
import { apiFetch } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";


export default function useCartPage() {

    const {getToken} = useAuth();

    const [checkoutLoading, setCheckoutLoading] = useState(false);

    const items = useCartStore(state => state.items);
    const setQuantity = useCartStore(state => state.setQuantity);
    const removeItem = useCartStore(state => state.removeItem);

    const {data, isLoading:productsLoading, isError:productsError} = useQuery({
        queryKey: ["products"],
        queryFn: () => apiFetch("/api/products"),
        enabled: items.length > 0
    });

    const products = data?.products ?? [];
    const byId = new Map(products.map(p => [p.id, p]));

    const lines = items.map(line => ({
        line,
        product: byId.get(line.productId) ?? null,
    }));

    const subTotal = lines.reduce((sum, { line, product: p }) => {
        const priceCents = Number(p?.priceCents ?? 0);
        const quantity = Number(line.quantity ?? 0);
        return sum + quantity * (Number.isFinite(priceCents) ? priceCents : 0);
    }, 0);

    async function checkout(){
        setCheckoutLoading(true);

        const body = {
            items: items.map(i => ({productId: i.productId, quantity: i.quantity}))
        }

        const res = await apiFetch("/api/checkout", {
            getToken,
            method: "POST",
            body
        }); 

        if(res?.checkoutUrl){
            window.location.href = res.checkoutUrl;
            return;
        }
        setCheckoutLoading(false);

    }

    return {
        items,
        setQuantity,
        removeItem,
        productsLoading,
        productsError,
        lines,
        subTotal,
        checkout,
        checkoutLoading
    }
}