# Palazzo Pinto B&B Frontend

A modern, responsive frontend application for Palazzo Pinto B&B. Built with React 18, TypeScript, Vite, and Tailwind CSS, featuring advanced search, booking management, and seamless user experience across all devices.

- **Frontend-Live-Demo:** [https://hotel-mern-booking.vercel.app/](https://hotel-mern-booking.vercel.app/)
- **Backend-Live-Demo:** [https://hotel-booking-backend.arnobmahmud.com](https://hotel-booking-backend.arnobmahmud.com)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)
![MernHolidays](https://img.shields.io/badge/MERN-Stack-blue?style=for-the-badge&logo=mongodb&logoColor=white)
![React](https://img.shields.io/badge/React-18.2.0-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0.2-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3.5-38B2AC?style=for-the-badge&logo=tailwind-css)

---

## 🎯 Frontend Overview

### **What This Frontend Provides**

This frontend serves as the **user interface** for a comprehensive hotel booking platform. It delivers an intuitive, responsive experience for travelers to discover, book, and manage hotel accommodations, while providing powerful tools for hotel owners to manage their properties.

### **Core User Experiences**

- **🔍 Hotel Discovery**: Advanced search with multiple filters and real-time results
- **📅 Booking Management**: Seamless booking process with secure payment integration
- **👤 User Management**: Registration, authentication, and profile management
- **🏢 Hotel Management**: Complete CRUD operations for hotel owners
- **📊 Analytics Dashboard**: Business insights and performance metrics
- **📱 Mobile-First**: Responsive design optimized for all devices

### Traffic Insights

The admin Traffic Insights dashboard shows device page-view counts and shares,
ranked page and country bar charts, and a full-width interactive city map.
The date range and audience apply to all charts; summary cards still cover
the last 24 hours. Geography covers the top 100 city/country pairs returned
by Application Insights, so country counts are totals within that subset,
not all traffic.

Use the city selector or map markers to inspect counts, the zoom controls to
explore, and **Reset world view** to return to the globe. The city charts
include locations that cannot be mapped. Coordinates are approximate city
centers resolved on the backend using the offline `cities.json` dataset;
missing, unmatched and ambiguous city names are not guessed. Deploy the
backend update with the frontend to enable city markers.

City data is from [GeoNames](https://www.geonames.org/) via
[cities.json](https://www.npmjs.com/package/cities.json), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); country/city names
are normalized for matching. No visitor locations are sent to a geocoding
service. The lazy-loaded map requests standard map tiles from OpenStreetMap
and displays attribution; tile access requires an internet connection.

### P&L full-screen editor

Open the full-screen editor from the Income or Expenses page. Edits save when
you leave a cell; Save all retries unsaved rows. Errors keep the edited values
visible until corrected or discarded. Tab moves across editable cells, Enter
moves down, and Shift+Enter adds a line in text cells. Use search, sorting,
pagination and column resizing to navigate large ledgers. In the booking
income sheet, the check-in markers, Notes, Room and Check-in are frozen by default.
The numbered Stay, Registration, Invoicing and Payment & review groups organize
the columns. Nights are calculated from check-in and check-out; for recorded
income, edit those dates to change the calculation. The Stay group includes an
editable arrival time; it uses the saved check-in time when no Income override
is present. Pax is the guest count.
Invoice date, tourist tax and payment status are optional manual details;
entering tourist tax does not automatically change amounts or totals.
Use the numbered group buttons to toggle groups independently, or All groups
to show them all; individual hidden columns and active filters still apply. Drag column handles
to reorder them, and use Configure columns and groups to show or hide groups
and choose how many visible columns to freeze. The field list can be filtered
to visible groups or a specific group, including one hidden from the grid.
Name and save multiple views for your account; each view stores column order,
group visibility, frozen-column count and widths. Use Save as default to make
the current layout your personal default when reopening the editor. Resize
columns using their header handles before saving a named or default view; those
widths are restored when the view is loaded. Use the picker beside a group
to choose its color directly, or create named colors and assign them to a group
or individual columns. Rename colors in the Column colors section, and use the color filter to focus on
those columns. Applying a group color replaces individual colors in that group;
the resulting column colors are saved with the view. Each
column's value filter lists values present in the income data; use Show value
filters to reveal them. Color settings
and active color and value filters are saved with the view; value filters
still apply when their columns are hidden. Site bookings and active Booking.com
events are loaded by check-in year; use the source selector to find each type.
iCal entries may be availability blocks and often lack guest, contact and price
data, so verify them before recording income. Guest name, reference, phone and
email can be edited as income-only overrides for either booking source; clear
an override to restore its source value. These edits do not change the original
booking or the address used for check-in emails. Room, dates and calculated
values remain read-only for booking-sourced rows; inclusion warnings refresh
when the editor is reopened. Recorded income shows possible site and
Booking.com matches based on reference or room and check-in; compare check-out
and guest details before deciding how to reconcile. These are suggestions only:
they do not link records or alter totals.

The Registration group includes independent Check-in desk and Self check-in
checkboxes at the start of the default grid, after row selection. Older views
that lack these columns also receive them at the start; saved views with their
own column order retain it. Use **Show check-in columns first** to move them to
the start of any view; this also shows Registration and clears the color filter.
They save immediately as P&L booking details, including on recorded income, and
can be filtered like other columns. They are manual markers only:
checking them does not send an email or mark a guest checked in.
The Check-in Desk shows only site and Booking.com bookings marked **Check-in
desk**, subject to its room, date and status filters; recorded income is not
linked to a booking. Select a horizon up to **Next 60 days** to see future
arrivals. Its counts also include only marked bookings. The admin
overview still shows all arrivals.

Select site or Booking.com rows and open Check-in actions to access each
staff check-in procedure or email guests individually. Desk emails invite
guests to check in with staff. Self check-in emails require the actual access
code for each booking, with an optional locker and breakfast setting; the
link contains the code and must be kept private. Only confirmed site bookings
and active Booking.com bookings with valid guest emails can receive invitations.
Recorded income cannot be selected because it is not linked to a booking.
Email acceptance is shown per guest; if delivery is unconfirmed, check sent
mail before retrying. Row selections and entered access codes are not saved in views.
Codes are included in guest emails and the sender's Sent mail; self check-in
submissions remain separate and do not automatically mark a booking checked in.

The staff check-in form loads the matching Income guest, contact, location,
payment and booking value details for site and Booking.com bookings. An Income
guest total does not specify adults and children; review the breakdown before
checking in. Booking value is not a verified balance due, and city tax is shown
separately because it may already be included. Notes on the form come from
Income and are saved to Income before check-in; they do not replace the original
booking's special requests. If Income notes change elsewhere, reload and review
before saving. Other Income overrides remain reporting details and do not change
the original address used for check-in invitations. On imported bookings,
prefilled Income contact details do not replace the original booking contact
unless staff edit those fields during check-in. Arrival time and special notes
are prefilled from Income; editing them in check-in also saves them to Income.
The booking's nationality and source are used where available.

### Booking.com screenshot import

On Income, choose **Import screenshot** and paste or select an image. The
English Tesseract neural OCR model and image processing run in the browser;
the image is not uploaded. OCR can misread or miss fields, so compare every
row with the image, correct dates and guest details, find bookings for the
stay dates, and explicitly select the matching active Booking.com booking.
Saving updates only the reviewed P&L details, not the underlying booking.
Rows without an existing match cannot be created through this panel. The
detected reservation total is never automatically assigned to a room: enter
and review each room's share, especially for multi-room reservations. Blank
amount and guest-count fields leave existing values unchanged.

### **Architecture Highlights**

```bash
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │  React Query    │    │  Tailwind CSS   │
│   (TypeScript)  │◄──►│  (State Mgmt)   │◄──►│   (Styling)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Router   │    │   Shadcn UI     │    │   Vite Build    │
│  (Navigation)   │    │  (Components)   │    │   (Dev Server)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 Quick Start

### **Prerequisites**

- Node.js (v18 or higher)
- Git
- Backend API running (local or deployed)

### **Installation**

```bash
# Clone the repository
git clone https://github.com/arnobt78/MERN-Hotel-Booking--React-FullStack.git
cd hotel-booking-frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure environment variables (see below)
# Start development server
npm run dev
```

### **Environment Configuration**

Create a `.env` file in the root directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000

# Auth & API
VITE_API_BASE_URL=http://localhost:5000

# Optional: Analytics (not used in this project yet)
VITE_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
```

---

## 📁 Project Structure

```bash
hotel-booking-frontend/
├── public/
│   └── vite.svg                # App icon and favicon
├── src/
│   ├── api-client.ts           # Centralized API client functions
│   ├── main.tsx                # Application entry point
│   ├── App.tsx                 # Main app component with routing
│   ├── index.css               # Global styles and Tailwind imports
│   ├── vite-env.d.ts           # Vite environment types
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # Shadcn UI components
│   │   │   ├── button.tsx      # Button component
│   │   │   ├── card.tsx        # Card component
│   │   │   ├── dialog.tsx      # Modal dialog component
│   │   │   ├── input.tsx       # Input field component
│   │   │   ├── label.tsx       # Label component
│   │   │   ├── separator.tsx   # Divider component
│   │   │   ├── textarea.tsx    # Textarea component
│   │   │   ├── toast.tsx       # Toast notification component
│   │   │   └── toaster.tsx     # Toast container component
│   │   ├── AdvancedSearch.tsx  # Advanced search component
│   │   ├── BookingDetailsSummary.tsx # Booking summary component
│   │   ├── BookingLogModal.tsx  # Booking details modal
│   │   ├── FacilitiesFilter.tsx # Facilities filter component
│   │   ├── Footer.tsx          # Site footer component
│   │   ├── Header.tsx          # Navigation header component
│   │   ├── Hero.tsx            # Landing page hero section
│   │   ├── HotelTypesFilter.tsx # Hotel types filter
│   │   ├── IconTest.tsx        # Icon testing component
│   │   ├── LastestDestinationCard.tsx # Featured destinations
│   │   ├── LoadingSpinner.tsx  # Loading indicator component
│   │   ├── Pagination.tsx      # Pagination component
│   │   ├── PriceFilter.tsx     # Price range filter
│   │   ├── ScrollToTop.tsx     # Scroll to top button
│   │   ├── SearchBar.tsx        # Search bar component
│   │   ├── SearchResultsCard.tsx # Hotel search result card
│   │   └── SignOutButton.tsx    # Sign out button component
│   ├── config/
│   │   └── hotel-options-config.ts # Hotel options configuration
│   ├── contexts/
│   │   ├── AppContext.tsx       # Global app context
│   │   └── SearchContext.tsx   # Search state context
│   ├── forms/                  # Form components
│   │   ├── GuestInfoForm/
│   │   │   └── GuestInfoForm.tsx # Guest information form
│   │   └── ManageHotelForm/
│   │       ├── ContactSection.tsx # Hotel contact section
│   │       ├── DetailsSection.tsx # Hotel details section
│   │       ├── FacilitiesSection.tsx # Hotel facilities section
│   │       ├── GuestsSection.tsx # Guest capacity section
│   │       ├── ImagesSection.tsx # Hotel images section
│   │       ├── ManageHotelForm.tsx # Main hotel form
│   │       ├── PoliciesSection.tsx # Hotel policies section
│   │       └── TypeSection.tsx  # Hotel type section
│   ├── hooks/
│   │   ├── use-toast.ts         # Toast notification hook
│   │   ├── useAppContext.ts    # App context hook
│   │   ├── useLoadingHooks.ts  # Loading state hooks
│   │   └── useSearchContext.ts # Search context hook
│   ├── layouts/
│   │   ├── AuthLayout.tsx      # Authentication layout
│   │   └── Layout.tsx          # Main app layout
│   ├── lib/
│   │   └── utils.ts            # Utility functions
│   └── pages/                  # Route-level page components
│       ├── AddHotel.tsx        # Add new hotel page
│       ├── AnalyticsDashboard.tsx # Business insights dashboard
│       ├── ApiDocs.tsx         # API documentation page
│       ├── ApiStatus.tsx       # API health status page
│       ├── Booking.tsx         # Booking confirmation page
│       ├── Detail.tsx          # Hotel details page
│       ├── EditHotel.tsx       # Edit hotel page
│       ├── Home.tsx            # Landing page
│       ├── MyBookings.tsx      # User bookings page
│       ├── MyHotels.tsx        # Hotel management page
│       ├── Register.tsx        # User registration page
│       ├── Search.tsx          # Hotel search results page
│       └── SignIn.tsx          # User sign-in page
├── index.html                  # HTML template with SEO metadata
├── package.json                # Dependencies and scripts
├── postcss.config.js           # PostCSS configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── tsconfig.node.json          # Node.js TypeScript config
├── vite.config.ts              # Vite build configuration
├── netlify.toml                # Netlify deployment configuration
└── README.md                   # This file
```

---

## 🔧 Technology Stack

### **Core Technologies**

- **React 18.2.0**: Modern UI library with hooks and concurrent features
- **TypeScript 5.0.2**: Type-safe JavaScript development
- **Vite 4.4.0**: Fast build tool and development server
- **React Router DOM**: Client-side routing and navigation

### **Styling & UI**

- **Tailwind CSS 3.3.5**: Utility-first CSS framework
- **Shadcn UI**: Modern, accessible component library
- **Lucide React**: Beautiful, customizable icons
- **PostCSS**: CSS processing and optimization

### **State Management & Data**

- **React Query**: Server state management and caching
- **React Context**: Global state management
- **React Hook Form**: Form handling and validation

### **Payment & Media**

- **SharePoint**: Document management (via backend)

### **Development Tools**

- **ESLint**: Code linting and quality
- **Prettier**: Code formatting
- **Playwright**: End-to-end testing (in e2e-tests directory)

---

## 🎨 Key Components

### **AdvancedSearch Component**

A comprehensive search component with multiple filters and real-time suggestions.

```typescript
// Usage Example
<AdvancedSearch
  onSearch={(searchData) => {
    // Handle search with advanced filters
    console.log(searchData);
  }}
  isExpanded={false}
/>
```

**Features:**

- Destination autocomplete with API suggestions
- Date range selection with calendar picker
- Guest count management (adults/children)
- Advanced filters (price, rating, facilities, hotel types)
- Quick search for popular destinations
- Responsive design for all screen sizes

### **Hero Component**

Landing page hero section with gradient background and search integration.

```typescript
// Usage Example
<Hero
  onSearch={(searchData) => {
    // Handle search from hero section
  }}
/>
```

**Features:**

- Full-width gradient background
- Integrated search component
- Feature highlights and call-to-action
- Responsive design with mobile optimization

### **AnalyticsDashboard Component**

P&L business insights for the selected year, derived from the same included income and expense records as the overview.

**Features:**

- Monthly income and expense chart with accessible figures
- Income by source, net margin and average included booking income
- Excludes P&L rows flagged for review, just like the overview totals

### **BookingLogModal Component**

Modal for viewing detailed booking information.

```typescript
// Usage Example
<BookingLogModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  hotelId="hotel-id"
  hotelName="Hotel Name"
/>
```

**Features:**

- Detailed booking information display
- Status management and updates
- Payment details and transaction history
- Guest information and special requests

---

## 📱 Pages & Routes

### **Public Pages**

| Route              | Component      | Description                       |
| ------------------ | -------------- | --------------------------------- |
| `/`                | `Home.tsx`     | Landing page with hero and search |
| `/search`          | `Search.tsx`   | Hotel search results with filters |
| `/detail/:hotelId` | `Detail.tsx`   | Hotel details and booking form    |
| `/register`        | `Register.tsx` | User registration form            |
| `/sign-in`         | `SignIn.tsx`   | User authentication form          |

### **Protected Pages**

| Route                  | Component                | Description                      | Auth Required |
| ---------------------- | ------------------------ | -------------------------------- | ------------- |
| `/booking/:hotelId`    | `Booking.tsx`            | Booking request submission | ✅            |
| `/my-bookings`         | `MyBookings.tsx`         | User's booking history           | ✅            |
| `/my-hotels`           | `MyHotels.tsx`           | Hotel management for owners      | ✅            |
| `/add-hotel`           | `AddHotel.tsx`           | Add new hotel listing            | ✅            |
| `/edit-hotel/:hotelId` | `EditHotel.tsx`          | Edit existing hotel              | ✅            |
| `/pnl`                 | `PnlOverview.tsx`        | P&L overview and business insights (admin only) | ✅ |
| `/business-insights`   | Redirect                 | Redirects to `/pnl`             | ✅            |

### **Utility Pages**

| Route         | Component       | Description                   |
| ------------- | --------------- | ----------------------------- |
| `/api-status` | `ApiStatus.tsx` | Backend API health monitoring |
| `/api-docs`   | `ApiDocs.tsx`   | API documentation viewer      |

---

## 🔐 Authentication & State Management

### **Dual Authentication System**

The frontend implements a **dual authentication system** to support both modern browsers and privacy-focused browsers:

```typescript
// API Client with dual authentication
const getRequestOptions = (method: string = "GET", body?: any) => {
  const options: RequestInit = {
    method,
    credentials: "include", // Try cookies first
    headers: getAuthHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
};

const getAuthHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // If we have a stored token, use Authorization header
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return headers;
};
```

### **Context Management**

```typescript
// App Context for global state
const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);

  return (
    <AppContext.Provider value={{ isLoggedIn, setIsLoggedIn, user, setUser }}>
      {children}
    </AppContext.Provider>
  );
};
```

---

## 🎨 Styling & Design System

### **Tailwind CSS Configuration**

```javascript
// tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

### **Shadcn UI Components**

The project uses Shadcn UI for consistent, accessible components:

```typescript
// Example: Button component usage
import { Button } from "@/components/ui/button";

<Button variant="default" size="lg">
  Book Now
</Button>

<Button variant="outline" size="sm">
  Cancel
</Button>
```

### **Responsive Design**

```typescript
// Responsive design patterns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid layout */}
</div>

<div className="text-sm sm:text-base lg:text-lg">
  {/* Responsive typography */}
</div>
```

---

## 🔄 Data Flow & API Integration

### **React Query Implementation**

```typescript
// Data fetching with React Query
import { useQuery, useMutation } from "@tanstack/react-query";

// Fetch hotels with caching
const {
  data: hotels,
  isLoading,
  error,
} = useQuery({
  queryKey: ["hotels", searchParams],
  queryFn: () => searchHotels(searchParams),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutate booking data
const bookingMutation = useMutation({
  mutationFn: createRoomBooking,
  onSuccess: () => {
    toast.success("Booking confirmed!");
    navigate("/my-bookings");
  },
  onError: (error) => {
    toast.error("Booking failed. Please try again.");
  },
});
```

### **API Client Structure**

```typescript
// Centralized API client
export const searchHotels = async (
  searchParams: SearchParams,
): Promise<HotelSearchResponse> => {
  const queryParams = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) queryParams.append(key, value.toString());
  });

  const response = await fetch(
    `${API_BASE_URL}/api/hotels/search?${queryParams}`,
  );

  if (!response.ok) {
    throw new Error("Error fetching hotels");
  }

  return response.json();
};
```

---

## 📩 Booking Requests

### **Booking Request Flow**

```typescript
const submitBookingRequest = async (hotelId: string, bookingRequest: BookingRequest) => {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${hotelId}/booking-request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingRequest),
  });

  if (!response.ok) {
    throw new Error("Error submitting booking request");
  }

  return response.json();
};
```

---

## 🎯 User Experience Features

### **Search & Filtering**

- **Advanced Search**: Multi-criteria hotel search
- **Real-time Filters**: Price, rating, facilities, hotel types
- **Smart Suggestions**: Destination autocomplete
- **Pagination**: Efficient data loading for large datasets
- **Sorting Options**: Price, rating, distance, relevance

### **Booking Experience**

- **Seamless Flow**: From search to booking confirmation
- **Guest Management**: Adult and child count tracking
- **Date Selection**: Calendar picker with availability check
- **Request Review**: Admin confirmation after request submission
- **Confirmation**: Email notifications and booking history

### **Hotel Management**

- **CRUD Operations**: Complete hotel listing management
- **Document Upload**: SharePoint integration for booking documents
- **Analytics Dashboard**: Business insights and performance metrics
- **Booking Management**: Real-time booking tracking

### **Responsive Design**

- **Mobile-First**: Optimized for all screen sizes
- **Touch-Friendly**: Intuitive mobile interactions
- **Progressive Enhancement**: Works without JavaScript
- **Accessibility**: WCAG 2.1 AA compliance

---

## 🚀 Deployment

### **Netlify Deployment**

1. **Connect Repository**
   - Link your GitHub repository to Netlify
   - Enable automatic deployments

2. **Build Configuration**

   ```bash
   Build Command: npm run build
   Publish Directory: dist
   ```

3. **Environment Variables**
   - Set `VITE_API_BASE_URL` to your production backend URL

4. **SPA Configuration**

   ```toml
   # netlify.toml
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

### **Production Checklist**

- [ ] Environment variables configured
- [ ] Backend API deployed and accessible
- [ ] CORS settings updated for production domain
- [ ] Performance optimization enabled
- [ ] Error monitoring configured

---

## 🧪 Testing

### **Component Testing**

```typescript
// Example: Component test
import { render, screen } from "@testing-library/react";
import { SearchBar } from "./SearchBar";

test("renders search bar", () => {
  render(<SearchBar />);
  expect(
    screen.getByPlaceholderText("Where are you going?")
  ).toBeInTheDocument();
});
```

### **E2E Testing**

```typescript
// Example: E2E test with Playwright
test("user can search for hotels", async ({ page }) => {
  await page.goto("/");
  await page.fill('[data-testid="destination-input"]', "London");
  await page.click('[data-testid="search-button"]');
  await expect(page.locator('[data-testid="hotel-card"]')).toHaveCount(5);
});
```

---

## 🔧 Development Commands

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

---

## 📈 Performance Optimization

### **Code Splitting**

```typescript
// Lazy loading for route components
import { lazy, Suspense } from "react";

const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const MyHotels = lazy(() => import("./pages/MyHotels"));

// Suspense wrapper
<Suspense fallback={<LoadingSpinner />}>
  <AnalyticsDashboard />
</Suspense>;
```

### **Image Optimization**

```typescript
// Optimized image loading
<img
  src={hotel.imageUrls[0]}
  alt={hotel.name}
  loading="lazy"
  className="w-full h-48 object-cover"
/>
```

### **Caching Strategy**

```typescript
// React Query caching
const { data: hotels } = useQuery({
  queryKey: ["hotels"],
  queryFn: fetchHotels,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

---

## 🔗 Integration Examples

### **Backend Integration**

```typescript
// API client integration
const apiClient = {
  baseURL: import.meta.env.VITE_API_BASE_URL,

  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },
};
```

### **Third-Party Integrations**

```typescript
// SharePoint/media helper
const optimizedImageUrl = (url: string, width: number) => {
  return url.replace("/upload/", `/upload/w_${width},c_fill/`);
};
```

---

## 🎯 Key Features Summary

### **✅ User-Centric Design**

- **Intuitive Interface**: Easy-to-use hotel search and booking
- **Responsive Design**: Optimized for all devices and screen sizes
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Fast loading and smooth interactions

### **✅ Developer-Friendly**

- **TypeScript**: Full type safety throughout
- **Modular Architecture**: Reusable components and hooks
- **Modern React**: Latest patterns and best practices
- **Comprehensive Documentation**: Clear examples and guides

### **✅ Production-Ready**

- **SEO Optimized**: Meta tags and structured data
- **Performance Optimized**: Code splitting and lazy loading
- **Security**: Secure authentication and data handling
- **Scalable**: Designed for growth and feature additions

---

## 🚀 Happy Coding! 🎉

This frontend is designed to be **user-friendly**, **developer-friendly**, and **production-ready**. Whether you're learning React development, building a startup, or extending an existing platform, this frontend provides an excellent foundation.

**Key Benefits:**

- 🎓 **Learning Resource**: Complete React + TypeScript implementation
- 👥 **User Experience**: Intuitive and responsive design
- 🔧 **Developer Experience**: Modern tools and best practices
- 📚 **Well Documented**: Comprehensive documentation and examples

**Get Started Today!** 🚀

This is an **open-source project** - feel free to use, enhance, and extend this project further!

If you have any questions or want to share your work, reach out via GitHub or my portfolio at [https://www.arnobmahmud.com/](https://www.arnobmahmud.com/).

**Enjoy building and learning!** 🚀

Thank you! 😊
