# Tailwind CSS v3 → v4 Migration Reference

> **🚨 CRITICAL REFERENCE**: This file documents all breaking changes from Tailwind CSS v3 to v4. AI assistants, code editors, and developers should **ALWAYS** use v4-compatible classes listed in this document.

## 🎯 Purpose
This document serves as a definitive reference to ensure all AI-powered tools and developers use Tailwind CSS v4-compatible class names. **Never use v3 syntax listed in the "❌ Removed/Deprecated" columns.**

---

## 🔥 Critical Breaking Changes

### 1. **Removed Deprecated Opacity Utilities**
**🚨 NEVER USE THESE v3 CLASSES:**

| ❌ Tailwind v3 (REMOVED) | ✅ Tailwind v4 (REQUIRED) | Description |
|---------------------------|----------------------------|-------------|
| `bg-opacity-*` | `bg-color/opacity` | Background opacity |
| `text-opacity-*` | `text-color/opacity` | Text opacity |
| `border-opacity-*` | `border-color/opacity` | Border opacity |
| `divide-opacity-*` | `divide-color/opacity` | Divide opacity |
| `ring-opacity-*` | `ring-color/opacity` | Ring opacity |
| `placeholder-opacity-*` | `placeholder-color/opacity` | Placeholder opacity |

**Examples:**
```html
<!-- ❌ WRONG (v3) - DO NOT USE -->
<div class="bg-blue-500 bg-opacity-50">
<div class="text-red-500 text-opacity-75">
<div class="border-gray-300 border-opacity-25">

<!-- ✅ CORRECT (v4) - ALWAYS USE -->
<div class="bg-blue-500/50">
<div class="text-red-500/75">
<div class="border-gray-300/25">
```

### 2. **Flex Utility Renames**
| ❌ Tailwind v3 (REMOVED) | ✅ Tailwind v4 (REQUIRED) |
|---------------------------|----------------------------|
| `flex-shrink-*` | `shrink-*` |
| `flex-grow-*` | `grow-*` |

### 3. **Text & Decoration Renames**
| ❌ Tailwind v3 (REMOVED) | ✅ Tailwind v4 (REQUIRED) |
|---------------------------|----------------------------|
| `overflow-ellipsis` | `text-ellipsis` |
| `decoration-slice` | `box-decoration-slice` |
| `decoration-clone` | `box-decoration-clone` |

---

## 📏 Scale Renames (Shadow, Blur, Border-Radius)

### **Shadow Utilities**
| ❌ Tailwind v3 | ✅ Tailwind v4 |
|-----------------|-----------------|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `drop-shadow-sm` | `drop-shadow-xs` |
| `drop-shadow` | `drop-shadow-sm` |

### **Blur Utilities**
| ❌ Tailwind v3 | ✅ Tailwind v4 |
|-----------------|-----------------|
| `blur-sm` | `blur-xs` |
| `blur` | `blur-sm` |
| `backdrop-blur-sm` | `backdrop-blur-xs` |
| `backdrop-blur` | `backdrop-blur-sm` |

### **Border-Radius Utilities**
| ❌ Tailwind v3 | ✅ Tailwind v4 |
|-----------------|-----------------|
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |

---

## 🎯 Outline & Ring Changes

### **Outline Utilities**
| ❌ Tailwind v3 | ✅ Tailwind v4 | Description |
|-----------------|-----------------|-------------|
| `outline-none` | `outline-hidden` | Maintains accessibility in forced colors |
| `outline outline-2` | `outline-2` | No need to combine with base `outline` |

### **Ring Utilities**
| ❌ Tailwind v3 | ✅ Tailwind v4 | Description |
|-----------------|-----------------|-------------|
| `ring` | `ring-3` | Default ring is now 1px, not 3px |
| `ring ring-blue-500` | `ring-3 ring-blue-500` | Must specify width explicitly |

---

## 🎨 Color & Border Defaults

### **Border Color Changes**
- **v3**: Borders defaulted to `gray-200`
- **v4**: Borders default to `currentColor`

```html
<!-- ❌ v3 behavior (automatic gray) -->
<div class="border">

<!-- ✅ v4 requirement (specify color) -->
<div class="border border-gray-200">
```

### **Ring Color Changes**
- **v3**: Ring defaulted to `blue-500`  
- **v4**: Ring defaults to `currentColor`

```html
<!-- ❌ v3 behavior (automatic blue) -->
<button class="focus:ring-3">

<!-- ✅ v4 requirement (specify color) -->
<button class="focus:ring-3 focus:ring-blue-500">
```

---

## 🔄 Variant Stacking Order

**⚠️ Breaking Change**: Variants now apply **left-to-right** instead of right-to-left

```html
<!-- ❌ v3 order (right-to-left) -->
<ul class="py-4 first:*:pt-0 last:*:pb-0">

<!-- ✅ v4 order (left-to-right) -->  
<ul class="py-4 *:first:pt-0 *:last:pb-0">
```

---

## 🖱️ Hover Behavior

**v4 Change**: `hover` only applies when primary input supports hover

```css
/* v4 generates: */
@media (hover: hover) {
  .hover\:underline:hover {
    text-decoration: underline;
  }
}
```

---

## 📱 Space-Between Selector Change

**Performance improvement** changed the selector:

```css
/* ❌ v3 selector */
.space-y-4 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1rem;
}

/* ✅ v4 selector */
.space-y-4 > :not(:last-child) {
  margin-bottom: 1rem;
}
```

**Recommendation**: Use `flex` with `gap` instead of `space-*` utilities.

---

## 🎭 CSS Import Changes

### **Import Syntax**
```css
/* ❌ v3 */
@tailwind base;
@tailwind components; 
@tailwind utilities;

/* ✅ v4 */
@import "tailwindcss";
```

### **Custom Utilities**
```css
/* ❌ v3 */
@layer utilities {
  .tab-4 {
    tab-size: 4;
  }
}

/* ✅ v4 */
@utility tab-4 {
  tab-size: 4;
}
```

---

## 🔧 CSS Variables in Arbitrary Values

```html
<!-- ❌ v3 syntax -->
<div class="bg-[--brand-color]">

<!-- ✅ v4 syntax -->
<div class="bg-(--brand-color)">
```

---

## 🎨 Preflight Changes

### **Placeholder Color**
- **v3**: Used configured `gray-400`
- **v4**: Uses current text color at 50% opacity

### **Button Cursor**
- **v3**: `cursor: pointer`
- **v4**: `cursor: default` (matches browser default)

### **Dialog Margins**
- **v3**: Browsers default centering
- **v4**: Margins reset to 0

---

## 🚫 Removed Features

### **No Longer Supported in v4:**
- `corePlugins` configuration option
- Automatic JavaScript config file detection
- `resolveConfig` function for theme values in JS
- Sass/Less/Stylus preprocessing support

---

## ✅ Migration Checklist

**Before using any Tailwind class, verify:**

- [ ] No `bg-opacity-*`, `text-opacity-*`, etc. → Use `/opacity` syntax
- [ ] No `flex-shrink-*` → Use `shrink-*`
- [ ] No `flex-grow-*` → Use `grow-*`  
- [ ] No bare `shadow`, `blur`, `rounded` → Use explicit sizes
- [ ] No `outline-none` → Use `outline-hidden`
- [ ] No bare `ring` → Use `ring-3` or specific width
- [ ] Specify border colors explicitly
- [ ] Specify ring colors explicitly
- [ ] Check variant stacking order (left-to-right)
- [ ] Use `@import "tailwindcss"` not `@tailwind` directives

---

## 🤖 AI Assistant Instructions

**When generating Tailwind CSS classes:**

1. **NEVER** use any class from the "❌ Removed/Deprecated" columns
2. **ALWAYS** use classes from the "✅ Required" columns  
3. **ALWAYS** specify colors for borders and rings
4. **PREFER** `/opacity` syntax over separate opacity classes
5. **DEFAULT** to modern v4 utilities and syntax

**Example AI Response Pattern:**
```html
<!-- Good AI response -->
<div class="bg-blue-500/50 border border-gray-200 rounded-sm shadow-xs focus:outline-hidden focus:ring-3 focus:ring-blue-500">

<!-- Bad AI response (contains v3 syntax) -->
<div class="bg-blue-500 bg-opacity-50 border rounded shadow focus:outline-none focus:ring ring-blue-500">
```

---

## 📚 References

- **Official Upgrade Guide**: https://tailwindcss.com/docs/upgrade-guide
- **Browser Support**: Safari 16.4+, Chrome 111+, Firefox 128+
- **Upgrade Tool**: `npx @tailwindcss/upgrade`

---

**🔒 Version**: Tailwind CSS v4.1  
**🗓️ Last Updated**: December 2024  
**🎯 Status**: Complete migration reference