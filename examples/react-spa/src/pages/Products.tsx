import { track } from '@analytics/tracker';
import './Pages.css';

export function Products() {
  const products = [
    { id: 'product-1', name: 'Premium Plan', price: '$29/mo' },
    { id: 'product-2', name: 'Enterprise Plan', price: '$99/mo' },
    { id: 'product-3', name: 'Starter Plan', price: '$9/mo' },
  ];

  const handleProductClick = (productId: string, productName: string) => {
    track('product_viewed', {
      productId,
      productName,
      page: 'products',
      timestamp: new Date().toISOString(),
    });
  };

  const handleAddToCart = (productId: string, productName: string, price: string) => {
    track('product_added_to_cart', {
      productId,
      productName,
      price,
      page: 'products',
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="page">
      <h1>Products</h1>
      <p className="subtitle">
        Browse our products. Each interaction is tracked as a custom event.
      </p>

      <div className="products-grid">
        {products.map((product) => (
          <div
            key={product.id}
            className="product-card"
            onClick={() => handleProductClick(product.id, product.name)}
          >
            <h3>{product.name}</h3>
            <p className="price">{product.price}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddToCart(product.id, product.name, product.price);
              }}
              className="btn btn-primary"
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>🛒 Shopping Events</h2>
        <p>Try these actions to see different event types:</p>
        <ul>
          <li><strong>Click on a product card</strong> → Tracks "product_viewed"</li>
          <li><strong>Click "Add to Cart"</strong> → Tracks "product_added_to_cart"</li>
        </ul>
        <p className="info-text">
          All events include metadata like product ID, name, and timestamp.
        </p>
      </div>
    </div>
  );
}
