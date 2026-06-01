import {create} from "zustand"
import {persist} from "zustand/middleware"

// persist will save the cart state in localStorage, so that it persists across page reloads
export const useCartStore = create(persist((set, get) => ({
    items: [],

    addItems(productId, quantity = 1){
        const items = [...get().items];
        const i = items.findIndex(item => item.productId === productId);
        if(i !== -1){
            items[i].quantity += quantity;
            //items[i] = {...items[i], quantity: items[i].quantity + quantity}; }
        } else {
            items.push({productId, quantity:quantity});
        }
        set({items});
    },

    removeItem(productId){
        set({items: get().items.filter(item => item.productId !== productId)});
    },

    setQuantity(productId, quantity){
        if(quantity <= 0){
            get().removeItem(productId);
            return;
        }
        const items = get().items.map(item => 
            item.productId === productId ? {...item, quantity} : item
         );
        set({items}
        )
    },
}), {name: "nextcart-cart"}));