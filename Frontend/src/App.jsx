import {
  Show,
  SignInButton,
  SignUpButton,
  useAuth,
  UserButton,
} from '@clerk/react';
import PageLoader from './components/PageLoader';
import Layout from './components/Layout';
import { Routes, Route, Navigate } from 'react-router';
import { HomePage } from './pages/HomePage';
import { CartPage } from './pages/CartPage';
import { OrdersPage } from './pages/OrdersPage';
import CheckoutReturnPage from './pages/CheckoutReturnPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import OrderSummaryPage from './pages/OrderSummaryPage';
import { OrderChatPage } from './pages/OrderChatPage';

function App() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <PageLoader />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/products/:slug" element={<ProductDetailsPage />} />
        <Route
          path="/orders"
          element={isSignedIn ? <OrdersPage /> : <Navigate to={'/'} replace />}
        />
        <Route path="/checkout/return" element={<CheckoutReturnPage />} />

        <Route path="/orders/:id" element={<OrderDetailsPage />}>
          <Route index element={<OrderSummaryPage />} />
          <Route path="chat" element={<OrderChatPage />} />
        </Route>
      </Routes>
    </Layout>
  );
}

export default App;
