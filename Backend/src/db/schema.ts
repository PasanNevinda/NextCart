import {pgTable, text, integer, timestamp, uuid, boolean, jsonb} from 'drizzle-orm/pg-core';
import {relations} from 'drizzle-orm';

export type OrderStatus = "pending" | "paid" | "failed";
export type UserRole = "admin" | "customer" | "support";

export type CheckoutSessionLine = {
    productId: string,
    quantity: number,
    unitPriceinCents: number
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull().default(""),
  displayName: text('display_name'),
  role: text("role").$type<UserRole>().notNull().default("customer"),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(""),
  category: text('category').notNull().default("General"),
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default("usd"),
  imageUrl: text('image_url'),
  imageKitFileId: text('imagekit_file_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

//
export const checkoutSessions = pgTable('checkout_sessions', {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, {onDelete: "cascade"}),
    lines: jsonb("lines").$type<CheckoutSessionLine[]>().notNull(),
    polarCheckoutId: text("polar_checkout_id").unique(),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()

});

export const orders = pgTable("orders", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, {onDelete: "cascade"}),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    polarCheckoutId: text("polar_checkout_id"),
    polarOrderId: text("polar_order_id").unique(),
    totalCents: integer("total_cents").notNull().default(0),
    createdAt: timestamp("created_at", {withTimezone: true}).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", {withTimezone: true}).defaultNow().notNull()
});


export const orderItems = pgTable("order_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
        .notNull()
        .references(() => orders.id, {onDelete: "cascade"}),
    productId: uuid("product_id")
        .notNull()
        .references(() => products.id, {onDelete: "restrict"}),
    quantity: integer("quantity").notNull(),
    unitPriceInCents: integer("unit_price_cents").notNull(),
});

// cascade = "delete childrens when the parent got deleted"
// restrict = "don't delete parent if any child still pointing at to it"


// a user can have many orders
export const userRelations = relations(users, ({ many }) =>({
    orders: many(orders),
}));


// same product can appear in many order lines
export const productRelations = relations(products, ({many}) =>({
    orderItems: many(orderItems)
}))

// each order belong to exact one user, each order can have many order lines (itesm)
export const orderRelations = relations(orders, ({one, many}) => ({
    items: many(orderItems),
    user: one(users, {
        fields: [orders.userId],
        references: [users.id],
    })
}));


// each orderItem is for exactly one order and one product
export const orderItemsRelations = relations(orderItems, ({one}) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id]
    }),

    product: one(products, {
        fields: [orderItems.productId],
        references: [products.id]
    })
}));
