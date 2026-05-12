// src/components/DepartmentMenu.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const DepartmentsMenu = ({ onClose }) => {
  const websitePages = [
    { name: 'Home', link: '/' },
    { name: 'All Products', link: '/products' },
    { name: 'Categories', link: '/categories' },
    { name: 'About Market Pulse', link: '/about' },
  ];

  const popularCategories = [
    { name: 'Electronics', link: '/products?category=electronics' },
    { name: 'Fashion', link: '/products?category=fashion' },
    { name: 'Home & Kitchen', link: '/products?category=home' },
    { name: 'Beauty', link: '/products?category=beauty' },
    { name: 'Sports', link: '/products?category=sports' },
    { name: 'Groceries', link: '/products?category=groceries' },
  ];

  const businessTypes = [
    { name: 'Brands', link: '/products?businessType=brand' },
    { name: 'Wholesalers', link: '/products?businessType=wholesaler' },
    { name: 'Manufacturers', link: '/products?businessType=manufacturer' },
    { name: 'Retailers', link: '/products?businessType=retailer' },
    { name: 'Farmers', link: '/products?businessType=farmer' },
    { name: 'Small Business', link: '/products?businessType=small_business' },
  ];

  const quickLinks = [
    { name: 'Cart', link: '/cart' },
    { name: 'Wishlist', link: '/wishlist' },
    { name: 'My Orders', link: '/orders' },
    { name: 'Profile', link: '/profile' },
  ];

  return (
    <div className="text-dark">
      {/* Website Pages */}
      <div className="border-b">
        <div className="p-3 font-semibold text-gray-700 border-b">Market Pulse center</div>
        <ul className="py-2">
          {websitePages.map((item, idx) => (
            <li key={idx}>
              <Link
                to={item.link}
                className="block px-3 py-2 hover:bg-gray-100"
                onClick={onClose}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Popular Categories */}
      <div className="border-b">
        <div className="p-3 font-semibold text-gray-700 border-b">Popular Categories</div>
        <ul className="py-2">
          {popularCategories.map((item, idx) => (
            <li key={idx}>
              <Link to={item.link} className="block px-3 py-2 hover:bg-gray-100" onClick={onClose}>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Business Types */}
      <div className="border-b">
        <div className="p-3 font-semibold text-gray-700 border-b">Shop by Business Type</div>
        <ul className="py-2">
          {businessTypes.map((item, idx) => (
            <li key={idx}>
              <Link to={item.link} className="block px-3 py-2 hover:bg-gray-100" onClick={onClose}>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick Links */}
      <div>
        <ul className="py-2">
          {quickLinks.map((item, idx) => (
            <li key={idx}>
              <Link to={item.link} className="block px-3 py-2 hover:bg-gray-100" onClick={onClose}>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default DepartmentsMenu;
