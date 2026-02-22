import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    name: 'Premium Headphones',
    nameAr: 'سماعات فاخرة',
    description: 'Wireless noise-cancelling headphones with 30hr battery',
    price: 299.99,
    image: '/products/headphones.jpg',
    stock: 50,
  },
  {
    name: 'Wireless Keyboard',
    nameAr: 'لوحة مفاتيح لاسلكية',
    description: 'Mechanical wireless keyboard with RGB backlight',
    price: 149.50,
    image: '/products/keyboard.jpg',
    stock: 80,
  },
  {
    name: 'USB-C Hub',
    nameAr: 'موزع يو إس بي سي',
    description: '7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader',
    price: 89.00,
    image: '/products/hub.jpg',
    stock: 120,
  },
  {
    name: 'Webcam HD',
    nameAr: 'كاميرا ويب عالية الدقة',
    description: '1080p webcam with built-in microphone and privacy shutter',
    price: 199.00,
    image: '/products/webcam.jpg',
    stock: 60,
  },
  {
    name: 'Mouse Pad XL',
    nameAr: 'لوحة فأرة كبيرة',
    description: 'Extended desk mat with anti-slip rubber base',
    price: 45.00,
    image: '/products/mousepad.jpg',
    stock: 200,
  },
  {
    name: 'Phone Stand',
    nameAr: 'حامل جوال',
    description: 'Adjustable aluminum phone and tablet stand',
    price: 35.00,
    image: '/products/stand.jpg',
    stock: 150,
  },
];

async function main() {
  console.log('Seeding database...');

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.name.toLowerCase().replace(/\s+/g, '-') },
      update: product,
      create: { id: product.name.toLowerCase().replace(/\s+/g, '-'), ...product },
    });
  }

  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
