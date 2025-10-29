# Monolit Beatz - Styling Guide

## Brand Colors

### Primary Palette
```css
--primary-red: #cc0000      /* Main brand red */
--accent-red: #e60000       /* Hover/active states */
--dark-bg: #0a0a0a         /* Main background */
--darker-bg: #000000       /* Deepest black */
--card-bg: #1a1a1a         /* Card/elevated surfaces */
--silver: #c0c0c0          /* Secondary accent */
--gray-text: #999999       /* Muted text */
--light-text: #ffffff      /* Primary text */
```

### HSL Values (for Tailwind)
```css
--background: 0 0% 3.9%           /* #0a0a0a */
--foreground: 0 0% 100%           /* #ffffff */
--card: 0 0% 10%                  /* #1a1a1a */
--primary: 0 100% 40%             /* #cc0000 */
--accent: 0 100% 45%              /* #e60000 */
--secondary: 0 0% 75.3%           /* #c0c0c0 */
--border: 0 100% 40% / 0.3        /* rgba(204, 0, 0, 0.3) */
```

## Typography

### Fonts
- **Display/Headings**: Playfair Display (600, 700, 800)
- **Body Text**: Inter (400, 500, 600, 700)
- **Monospace**: Geist

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-serif: 'Playfair Display', Georgia, serif;
--font-mono: 'Geist', monospace;
```

### Font Loading
```html
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
```

## Design System

### Border Radius
```css
--radius: 0rem;  /* Sharp, angular design - NO rounded corners */
```

### Shadows (Red Glow Effects)
```css
--shadow-2xs: 0 2px 8px rgba(204, 0, 0, 0.2);
--shadow-xs: 0 4px 12px rgba(204, 0, 0, 0.25);
--shadow-sm: 0 5px 15px rgba(204, 0, 0, 0.3);
--shadow: 0 10px 30px rgba(204, 0, 0, 0.4);
--shadow-md: 0 15px 40px rgba(204, 0, 0, 0.5);
--shadow-lg: 0 20px 50px rgba(204, 0, 0, 0.6);
--shadow-xl: 0 25px 60px rgba(204, 0, 0, 0.7);
--shadow-2xl: 0 30px 80px rgba(204, 0, 0, 0.8);
```

### Letter Spacing
```css
--tracking-normal: -0.01em;  /* Slightly tighter for modern look */
```

## Component Styling

### Buttons
```css
/* Primary Button (Red) */
background: #cc0000;
color: #ffffff;
box-shadow: 0 0 20px rgba(204, 0, 0, 0.5);

/* Hover */
background: #e60000;
box-shadow: 0 0 30px rgba(230, 0, 0, 0.8);
```

### Cards
```css
background: linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(10, 10, 10, 0.95) 100%);
border: 2px solid rgba(204, 0, 0, 0.3);

/* Hover */
border-color: rgba(204, 0, 0, 0.6);
box-shadow: 0 0 40px rgba(204, 0, 0, 0.4);
transform: translateY(-4px);
```

### Sliders
```css
/* Track */
background-color: rgba(192, 192, 192, 0.5);
border: 1px solid rgba(192, 192, 192, 0.7);
height: 8px;

/* Filled Range */
background-color: #cc0000;
box-shadow: 0 0 10px rgba(204, 0, 0, 0.6);

/* Thumb */
width: 20px;
height: 20px;
background-color: #cc0000;
border: 3px solid #ffffff;
box-shadow: 0 0 15px rgba(204, 0, 0, 0.8);

/* Thumb Hover */
background-color: #e60000;
box-shadow: 0 0 25px rgba(230, 0, 0, 1);
transform: scale(1.15);
```

### Dropdowns/Selects
```css
background-color: #1a1a1a;
border: 2px solid rgba(204, 0, 0, 0.4);
box-shadow: 0 10px 40px rgba(204, 0, 0, 0.5);
color: #ffffff;

/* Items Hover */
background-color: rgba(204, 0, 0, 0.2);
color: #cc0000;

/* Selected Item */
background-color: rgba(204, 0, 0, 0.3);
color: #e60000;
```

### Note Indicators (Track Preview)
```css
border: 2px solid rgba(204, 0, 0, 0.3);

/* Active */
background-color: #e60000;
border-color: #cc0000;
box-shadow: 0 0 15px rgba(230, 0, 0, 0.6);
transform: scale(1.1);
```

## Text Styling

### Headings
```css
color: #ffffff;
text-shadow: 0 0 20px rgba(204, 0, 0, 0.4);  /* Red glow for emphasis */
```

### Body Text
```css
color: #ffffff;
```

### Muted Text
```css
color: #999999;
```

### Primary/Accent Text
```css
color: #cc0000;
text-shadow: 0 0 20px rgba(204, 0, 0, 0.4);
```

## Animation & Transitions

### Standard Transition
```css
transition: all 0.3s ease;
```

### Card Transition
```css
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

### Pulse Animation (Loading)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
```

## CSS File Location
`client/index.css` - All custom Monolit Beatz styling

## Tailwind Classes to Use
- `bg-background` - Main background (#0a0a0a)
- `bg-card` - Card background (#1a1a1a)
- `bg-primary` - Red buttons/accents (#cc0000)
- `text-foreground` - White text (#ffffff)
- `text-primary` - Red text (#cc0000)
- `text-muted-foreground` - Gray text (#999999)
- `border-border` - Red border with opacity

## Design Principles
1. **Sharp & Angular** - No rounded corners (border-radius: 0)
2. **High Contrast** - Pure black backgrounds with white text
3. **Red Accents** - Used sparingly for emphasis and interaction
4. **Glow Effects** - Red box-shadows for depth and energy
5. **Futuristic** - Modern fonts with tight spacing
6. **Aggressive** - Bold red colors suggest power and intensity
