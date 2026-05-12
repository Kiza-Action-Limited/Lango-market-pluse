import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaLayerGroup,
  FaThLarge,
  FaWhatsapp,
} from 'react-icons/fa';
import slideImage1 from '../assets/images/240_F_1204665252_ZX7G4szbgbzeLf9M2OSYKu32GfBT6qWC.jpg';
import slideImage2 from '../assets/images/240_F_1671818644_Ddbso43PyJfSVubnXaL7rmXfRww6Dkjz.jpg';
import slideImage3 from '../assets/images/240_F_1693527828_L7tgoYmYIn1hayBctZQBpBy1gMLpK4pQ.jpg';
import slideImage4 from '../assets/images/240_F_1727631229_Jvja9SE3o82p1C7Io8pDek06qHddbyp8.jpg';
import slideImage5 from '../assets/images/240_F_1770944832_gErqIw7TSdo3GuKK7fnZ8VyExTFEynyJ.jpg';

const UnimartStyleShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const navigate = useNavigate();
  const whatsappNumber = '254700000000';
  const whatsappMessage = encodeURIComponent('Hello Lango Market Pulse support team, I need assistance.');
  const whatsappChatUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const heroSlides = useMemo(
    () => [
      { image: slideImage1, title: 'Smart accessories sale' },
      { image: slideImage2, title: 'Fashion spotlight' },
      { image: slideImage3, title: 'Home essentials' },
      { image: slideImage4, title: 'Beauty showcase' },
    ],
    []
  );

  const sideAds = useMemo(
    () => [
      { image: slideImage5, alt: 'Ad card 1' },
      { image: slideImage2, alt: 'Ad card 2' },
      { image: slideImage4, alt: 'Ad card 3' },
      { image: slideImage1, alt: 'Ad card 4' },
    ],
    []
  );

  const tabs = [
    'JEWELRY AND ACCESSORIES',
    'FASHION AND WEARABLES',
    'FOOT WEARS',
    'PHONES, GADGETS AND ACCESSORIES',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroSlides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortBy(value);
    navigate(`/products?sortBy=${encodeURIComponent(value)}`);
  };

  return (
    <section className="bg-[#ECECEC] border-b border-gray-300">
      <div className="mx-auto max-w-[1366px] px-3 py-1">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-3">
          <div className="space-y-3">
            {sideAds.slice(0, 2).map((ad, idx) => (
              <div key={idx} className="hover-card relative rounded-2xl overflow-hidden bg-white h-[190px]">
                <img src={ad.image} alt={ad.alt} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 rounded">AD</span>
                <button className="absolute right-2 bottom-2 h-7 w-7 rounded-full bg-[#F2871A] text-white flex items-center justify-center">
                  <FaChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="hover-card relative rounded-2xl overflow-hidden bg-white h-[390px]">
            <img src={heroSlides[activeIndex].image} alt={heroSlides[activeIndex].title} className="w-full h-full object-cover" />
            <button
              onClick={() => setActiveIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl"
            >
              <FaChevronLeft />
            </button>
            <button
              onClick={() => setActiveIndex((prev) => (prev + 1) % heroSlides.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl"
            >
              <FaChevronRight />
            </button>
            <Link
              to="/products"
              className="absolute left-7 bottom-8 bg-[#F2871A] text-white px-5 py-2 rounded-full text-lg font-semibold inline-flex items-center gap-2"
            >
              Explore Now
              <FaChevronRight size={12} />
            </Link>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-2.5 rounded-full ${activeIndex === idx ? 'w-8 bg-[#F2871A]' : 'w-2.5 bg-white/80'}`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {sideAds.slice(2, 4).map((ad, idx) => (
              <div key={idx} className="hover-card relative rounded-2xl overflow-hidden bg-white h-[190px]">
                <img src={ad.image} alt={ad.alt} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 rounded">AD</span>
                <button className="absolute right-2 bottom-2 h-7 w-7 rounded-full bg-[#F2871A] text-white flex items-center justify-center">
                  <FaChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1 bg-[#F2871A] text-white rounded-b-md overflow-x-auto">
          <div className="min-w-max flex">
            {tabs.map((tab) => (
              <button
                key={tab}
                className="hover-card-soft px-6 py-3 text-sm font-semibold border-r border-white/20 hover:bg-[#E9790F] whitespace-nowrap"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#F2F2F2] border border-gray-300 rounded-b-lg px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 sm:gap-3 relative">
          <Link
            to="/products"
            className="min-h-10 px-4 sm:px-5 py-2 rounded-full border border-gray-300 bg-white text-[#374151] inline-flex items-center gap-2 text-sm"
          >
            <FaFilter size={14} />
            Filters
          </Link>

          <label className="relative min-h-10 inline-flex items-center">
            <select
              value={sortBy}
              onChange={handleSortChange}
              className="appearance-none min-h-10 pr-8 pl-4 sm:pl-5 py-2 rounded-full border border-gray-300 bg-white text-[#374151] text-sm focus:outline-none"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="price_asc">Sort by: Price low-high</option>
              <option value="price_desc">Sort by: Price high-low</option>
              <option value="rating">Sort by: Top rated</option>
            </select>
            <FaChevronDown size={12} className="pointer-events-none absolute right-3 text-[#6B7280]" />
          </label>

          <Link
            to="/products"
            className="min-h-10 px-4 sm:px-5 py-2 rounded-full bg-[#F2871A] text-white font-semibold inline-flex items-center gap-2 text-sm"
          >
            <FaLayerGroup size={13} />
            Products
          </Link>

          <Link
            to="/categories"
            className="min-h-10 px-4 sm:px-5 py-2 rounded-full bg-[#16A34A] text-white font-semibold inline-flex items-center gap-2 text-sm"
          >
            <FaThLarge size={13} />
            Categories
          </Link>

          <div className="ml-auto text-[#374151] text-sm hidden sm:block">Browse platform catalog</div>

          <a
            href={whatsappChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="fixed right-3 bottom-20 md:right-4 md:bottom-24 z-30 h-12 w-12 md:h-auto md:w-auto md:px-5 md:py-3 rounded-full bg-[#25D366] text-white font-semibold shadow-lg inline-flex items-center justify-center gap-2 hover:brightness-105 transition"
          >
            <FaWhatsapp size={20} />
            <span className="hidden md:inline">Chat with us</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default UnimartStyleShowcase;
