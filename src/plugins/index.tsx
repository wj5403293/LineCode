import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { fontSizes, radius, spacing } from '../constants/theme';
import { useTheme } from '../theme';

export type PluginHookMode = 'before' | 'after' | 'around' | 'replace';

export interface PluginPageManifest {
  id: string;
  title?: string;
  view: string;
  script: string;
}

export interface PluginHookManifest {
  name: string;
  mode: PluginHookMode;
  script: string;
  allowSkipSuper: boolean;
}

export interface PluginMenuItemManifest {
  id: string;
  title: string;
  icon?: string;
  page?: string;
}

export interface PluginMenuContribution {
  target: string;
  items: PluginMenuItemManifest[];
}

export interface PluginContributions {
  menus: PluginMenuContribution[];
  settingsPages: string[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  pages: PluginPageManifest[];
  hooks: PluginHookManifest[];
  contributes: PluginContributions;
}

export interface PluginKeyValueStorage {
  get(key: string): unknown | Promise<unknown>;
  set(key: string, value: unknown): unknown | Promise<unknown>;
}

export interface PluginLineMlNode {
  type: string;
  attributes: Record<string, string>;
  children: PluginLineMlNode[];
  text?: string;
}

export type PluginEventHandler = (event: PluginDomEvent) => unknown | Promise<unknown>;

export interface PluginDomEvent {
  type: string;
  target: PluginElement;
  currentTarget: PluginElement;
  source: {
    pluginId: string;
    pageInstanceId: string;
    elementId?: string;
  };
}

export class PluginElement {
  readonly id?: string;
  readonly tagName: string;
  readonly children: PluginElement[] = [];
  onclick?: PluginEventHandler;
  onchange?: PluginEventHandler;
  oninput?: PluginEventHandler;
  value: unknown;
  checked = false;
  textContent = '';
  hidden = false;
  disabled = false;

  private readonly attributes: Record<string, string>;
  private readonly listeners = new Map<string, PluginEventHandler[]>();
  private readonly pluginId: string;
  private readonly pageInstanceId: string;

  constructor(input: {
    tagName: string;
    attributes?: Record<string, string>;
    textContent?: string;
    pluginId: string;
    pageInstanceId: string;
  }) {
    this.tagName = input.tagName;
    this.attributes = { ...(input.attributes ?? {}) };
    this.id = this.attributes.id;
    this.textContent = input.textContent ?? '';
    this.pluginId = input.pluginId;
    this.pageInstanceId = input.pageInstanceId;
    Object.entries(this.attributes).forEach(([name, value]) => this.applyAttribute(name, value));
  }

  getAttribute(name: string): string | undefined {
    return this.attributes[name];
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    this.applyAttribute(name, value);
  }

  addEventListener(type: string, handler: PluginEventHandler): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, handler: PluginEventHandler): void {
    const handlers = this.listeners.get(type) ?? [];
    this.listeners.set(type, handlers.filter(item => item !== handler));
  }

  async dispatchEvent(type: string): Promise<void> {
    const event: PluginDomEvent = {
      type,
      target: this,
      currentTarget: this,
      source: {
        pluginId: this.pluginId,
        pageInstanceId: this.pageInstanceId,
        elementId: this.id,
      },
    };

    const propertyHandler = this.getEventPropertyHandler(type);
    if (propertyHandler) {
      await propertyHandler.call(this, event);
    }

    for (const handler of this.listeners.get(type) ?? []) {
      await handler.call(this, event);
    }
  }

  async click(): Promise<void> {
    await this.dispatchEvent('click');
  }

  appendChild(child: PluginElement): void {
    this.children.push(child);
  }

  remove(): void {
    this.hidden = true;
  }

  private getEventPropertyHandler(type: string): PluginEventHandler | undefined {
    const handler = (this as unknown as Record<string, unknown>)[`on${type}`];
    return typeof handler === 'function' ? handler as PluginEventHandler : undefined;
  }

  private applyAttribute(name: string, value: string): void {
    if (name === 'value') {
      this.value = value;
    }
    if (name === 'checked') {
      this.checked = value === 'true';
    }
    if (name === 'hidden') {
      this.hidden = value === 'true';
    }
    if (name === 'disabled') {
      this.disabled = value === 'true';
    }
  }
}

export class PluginDocument {
  readonly root: PluginElement;
  readonly pageInstanceId: string;

  private readonly elementsById = new Map<string, PluginElement>();

  constructor(input: { root: PluginElement; pageInstanceId: string; elementsById: Map<string, PluginElement> }) {
    this.root = input.root;
    this.pageInstanceId = input.pageInstanceId;
    this.elementsById = input.elementsById;
  }

  getElementById(id: string): PluginElement | null {
    return this.elementsById.get(id) ?? null;
  }

  querySelector(selector: string): PluginElement | null {
    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }

    return this.findFirstByTag(this.root, selector.toLowerCase());
  }

  querySelectorAll(selector: string): PluginElement[] {
    if (selector.startsWith('#')) {
      const element = this.getElementById(selector.slice(1));
      return element ? [element] : [];
    }

    const matches: PluginElement[] = [];
    this.walk(this.root, element => {
      if (element.tagName.toLowerCase() === selector.toLowerCase()) {
        matches.push(element);
      }
    });
    return matches;
  }

  createElement(tagName: string): PluginElement {
    return new PluginElement({
      tagName,
      pluginId: this.root.getAttribute('data-plugin-id') ?? 'unknown',
      pageInstanceId: this.pageInstanceId,
    });
  }

  private findFirstByTag(root: PluginElement, tagName: string): PluginElement | null {
    if (root.tagName.toLowerCase() === tagName) {
      return root;
    }

    for (const child of root.children) {
      const match = this.findFirstByTag(child, tagName);
      if (match) return match;
    }

    return null;
  }

  private walk(element: PluginElement, visit: (element: PluginElement) => void): void {
    visit(element);
    element.children.forEach(child => this.walk(child, visit));
  }
}

export interface PluginSettingsApi {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface PluginToastApi {
  show(message: string): Promise<void>;
}

export type PluginHookEvent<TEvent extends Record<string, unknown>, TResult> = TEvent & {
  super(): Promise<TResult>;
};

export type HostHookHandler<TEvent extends Record<string, unknown>, TResult> = (
  event: PluginHookEvent<TEvent, TResult>,
) => Promise<TResult> | TResult;

export class HostHookManager {
  private readonly handlers = new Map<string, HostHookHandler<Record<string, unknown>, unknown>[]>();

  register<TEvent extends Record<string, unknown>, TResult>(
    name: string,
    handler: HostHookHandler<TEvent, TResult>,
  ): () => void {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(handler as HostHookHandler<Record<string, unknown>, unknown>);
    this.handlers.set(name, handlers);

    return () => {
      const current = this.handlers.get(name) ?? [];
      this.handlers.set(name, current.filter(item => item !== handler));
    };
  }

  async invoke<TEvent extends Record<string, unknown>, TResult>(
    name: string,
    event: TEvent,
    original: (event: TEvent) => Promise<TResult>,
  ): Promise<TResult> {
    const handlers = this.handlers.get(name) ?? [];

    const invokeAt = async (index: number, currentEvent: TEvent): Promise<TResult> => {
      if (index >= handlers.length) {
        return original(currentEvent);
      }

      const hookEvent = currentEvent as unknown as PluginHookEvent<TEvent, TResult>;
      hookEvent.super = () => invokeAt(index + 1, currentEvent);
      return await handlers[index](hookEvent as unknown as PluginHookEvent<Record<string, unknown>, unknown>) as TResult;
    };

    return invokeAt(0, event);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export function createHookManager(): HostHookManager {
  return new HostHookManager();
}

export const chatHookManager = createHookManager();

export interface PluginHooksApi {
  on<TEvent extends Record<string, unknown>, TResult>(
    name: string,
    handler: (event: PluginHookEvent<TEvent, TResult>) => Promise<TResult> | TResult,
  ): void;
}

export interface PluginScriptContext {
  pluginId: string;
  document: PluginDocument;
  settings: PluginSettingsApi;
  toast: PluginToastApi;
  hooks: PluginHooksApi;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    attributes[match[1]] = decodeXml(match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function getSingleTagAttributes(xml: string, tagName: string): Record<string, string> | null {
  const match = new RegExp(`<${tagName}\\b([^>]*)>`, 'i').exec(xml);
  return match ? parseAttributes(match[1]) : null;
}

function getSection(xml: string, tagName: string): string {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(xml);
  return match?.[1] ?? '';
}

const FORBIDDEN_PERMISSION_PATTERNS = [
  /^secrets\.readAll$/,
  /^secrets\.export$/,
  /^security\./,
  /^plugin\.permission\./,
  /^hostDom\./,
  /^hostStore\.readAll$/,
  /^native\./,
  /^runtime\.loadNativeModule$/,
  /^filesystem\.readAll$/,
  /^filesystem\.writeAppCode$/,
  /^network\.proxyAllTraffic$/,
  /^hook\.security\./,
  /^hook\.permission\./,
  /^hook\.pluginRuntime\./,
];

const FORBIDDEN_HOOK_PATTERNS = [
  /^security\./,
  /^permission\./,
  /^pluginRuntime\./,
  /^secrets\./,
  /^hotUpdate\./,
  /^app\.bootstrap$/,
  /^app\.update$/,
  /^database\.rawQuery$/,
  /^filesystem\./,
  /^native\./,
];

const ALLOWED_LINEML_ATTRIBUTES_BY_COMPONENT: Record<string, Set<string>> = {
  Page: new Set(['id', 'title']),
  Stack: new Set(['id', 'padding', 'spacing', 'hidden', 'disabled']),
  Row: new Set(['id', 'gap', 'padding', 'hidden', 'disabled']),
  Scroll: new Set(['id', 'hidden', 'disabled']),
  Text: new Set(['id', 'variant', 'color', 'hidden', 'disabled']),
  Markdown: new Set(['id', 'content', 'hidden', 'disabled']),
  CodeBlock: new Set(['id', 'language', 'hidden', 'disabled']),
  Button: new Set(['id', 'variant', 'size', 'hidden', 'disabled']),
  Input: new Set(['id', 'label', 'placeholder', 'secure', 'value', 'hidden', 'disabled']),
  TextArea: new Set(['id', 'label', 'placeholder', 'minLines', 'value', 'hidden', 'disabled']),
  Switch: new Set(['id', 'label', 'checked', 'hidden', 'disabled']),
  Select: new Set(['id', 'label', 'value', 'hidden', 'disabled']),
  Option: new Set(['id', 'value', 'hidden', 'disabled']),
  Card: new Set(['id', 'tone', 'hidden', 'disabled']),
  Section: new Set(['id', 'title', 'hidden', 'disabled']),
  Divider: new Set(['id', 'hidden']),
  Spacer: new Set(['id', 'size', 'hidden']),
};

const TOKEN_ATTRIBUTES: Record<string, Record<string, Set<string>>> = {
  Button: {
    variant: new Set(['primary', 'secondary', 'ghost', 'danger']),
    size: new Set(['sm', 'md', 'lg']),
  },
  Text: {
    variant: new Set(['title', 'subtitle', 'body', 'caption', 'code']),
    color: new Set(['primary', 'secondary', 'success', 'warning', 'danger', 'muted']),
  },
  Stack: {
    padding: new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl']),
    spacing: new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl']),
  },
  Row: {
    padding: new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl']),
    gap: new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl']),
  },
  Card: {
    tone: new Set(['normal', 'info', 'success', 'warning', 'danger']),
  },
  Spacer: {
    size: new Set(['xs', 'sm', 'md', 'lg', 'xl']),
  },
};

function isForbiddenByPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(value));
}

function assertAllowedPermission(permission: string): void {
  if (isForbiddenByPattern(permission, FORBIDDEN_PERMISSION_PATTERNS)) {
    throw new Error(`Forbidden plugin permission: ${permission}`);
  }
}

function assertAllowedHook(hookName: string): void {
  if (isForbiddenByPattern(hookName, FORBIDDEN_HOOK_PATTERNS)) {
    throw new Error(`Forbidden plugin hook: ${hookName}`);
  }
}

function validateLineMlNode(node: PluginLineMlNode): void {
  const allowedAttributes = ALLOWED_LINEML_ATTRIBUTES_BY_COMPONENT[node.type];
  if (!allowedAttributes) {
    throw new Error(`Unsupported plugin LineML component: ${node.type}`);
  }

  for (const [attribute, value] of Object.entries(node.attributes)) {
    if (!allowedAttributes.has(attribute)) {
      throw new Error(`Unsupported plugin LineML attribute on ${node.type}: ${attribute}`);
    }

    const allowedTokens = TOKEN_ATTRIBUTES[node.type]?.[attribute];
    if (allowedTokens && !allowedTokens.has(value)) {
      throw new Error(`Invalid token for ${node.type}.${attribute}: ${value}`);
    }
  }

  node.children.forEach(validateLineMlNode);
}

export function parsePluginManifestXml(xml: string): PluginManifest {
  const pluginAttributes = getSingleTagAttributes(xml, 'Plugin');
  if (!pluginAttributes?.id || !pluginAttributes.name || !pluginAttributes.version) {
    throw new Error('Invalid plugin manifest: Plugin id, name and version are required.');
  }

  const permissions = Array.from(xml.matchAll(/<Permission\b([^>]*)\/>/gi))
    .map(match => parseAttributes(match[1]).name)
    .filter((name): name is string => !!name);
  permissions.forEach(assertAllowedPermission);

  const pages = Array.from(getSection(xml, 'Pages').matchAll(/<Page\b([^>]*)\/>/gi))
    .map(match => parseAttributes(match[1]))
    .filter(attributes => attributes.id && attributes.view && attributes.script)
    .map(attributes => ({
      id: attributes.id,
      title: attributes.title,
      view: attributes.view,
      script: attributes.script,
    }));

  const hooks = Array.from(getSection(xml, 'Hooks').matchAll(/<Hook\b([^>]*)\/>/gi))
    .map(match => parseAttributes(match[1]))
    .filter(attributes => attributes.name && attributes.mode && attributes.script)
    .map(attributes => {
      assertAllowedHook(attributes.name);
      return {
        name: attributes.name,
        mode: attributes.mode as PluginHookMode,
        script: attributes.script,
        allowSkipSuper: attributes.allowSkipSuper === 'true',
      };
    });

  const menus = Array.from(getSection(xml, 'Contributes').matchAll(/<Menu\b([^>]*)>([\s\S]*?)<\/Menu>/gi))
    .map(match => {
      const menuAttributes = parseAttributes(match[1]);
      const items = Array.from(match[2].matchAll(/<Item\b([^>]*)\/>/gi))
        .map(itemMatch => parseAttributes(itemMatch[1]))
        .filter(attributes => attributes.id && attributes.title)
        .map(attributes => ({
          id: attributes.id,
          title: attributes.title,
          icon: attributes.icon,
          page: attributes.page,
        }));

      return { target: menuAttributes.target, items };
    })
    .filter(menu => !!menu.target);

  const settingsPages = Array.from(getSection(xml, 'Settings').matchAll(/<PageRef\b([^>]*)\/>/gi))
    .map(match => parseAttributes(match[1]).id)
    .filter((id): id is string => !!id);

  return {
    id: pluginAttributes.id,
    name: pluginAttributes.name,
    version: pluginAttributes.version,
    permissions,
    pages,
    hooks,
    contributes: { menus, settingsPages },
  };
}

export function parsePluginLineMl(xml: string): PluginLineMlNode {
  const root: PluginLineMlNode = { type: 'Root', attributes: {}, children: [] };
  const stack: PluginLineMlNode[] = [root];
  const pattern = /<([^!?][^>]*?)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const tagToken = match[1];
    const textToken = match[2];

    if (textToken) {
      const text = decodeXml(textToken).trim();
      if (text) {
        const current = stack[stack.length - 1];
        current.text = current.text ? `${current.text}${text}` : text;
      }
      continue;
    }

    if (!tagToken) continue;
    const tag = tagToken.trim();
    if (tag.startsWith('/')) {
      stack.pop();
      continue;
    }

    const selfClosing = tag.endsWith('/');
    const normalized = selfClosing ? tag.slice(0, -1).trim() : tag;
    const spaceIndex = normalized.search(/\s/);
    const type = spaceIndex === -1 ? normalized : normalized.slice(0, spaceIndex);
    const rawAttributes = spaceIndex === -1 ? '' : normalized.slice(spaceIndex + 1);
    const node: PluginLineMlNode = {
      type,
      attributes: parseAttributes(rawAttributes),
      children: [],
    };

    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
  }

  if (root.children.length !== 1) {
    throw new Error('LineML must contain exactly one root element.');
  }

  validateLineMlNode(root.children[0]);
  return root.children[0];
}

let nextPageInstanceId = 1;

class ScopedPluginSettings implements PluginSettingsApi {
  private readonly pluginId: string;
  private readonly storage: PluginKeyValueStorage;

  constructor(pluginId: string, storage?: PluginKeyValueStorage) {
    this.pluginId = pluginId;
    this.storage = storage ?? new Map<string, unknown>();
  }

  async get(key: string): Promise<unknown> {
    return await this.storage.get(this.scopedKey(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.storage.set(this.scopedKey(key), value);
  }

  private scopedKey(key: string): string {
    return `plugin:${this.pluginId}:settings:${key}`;
  }
}

interface CreateScriptContextOptions {
  toast?: PluginToastApi;
  hostHooks?: HostHookManager;
  onDispose?: (dispose: () => void) => void;
}

export class PluginRuntime {
  readonly settings: PluginSettingsApi;

  private readonly manifest: PluginManifest;
  private readonly hookHandlers = new HostHookManager();

  constructor(manifest: PluginManifest, storage?: PluginKeyValueStorage) {
    this.manifest = manifest;
    manifest.permissions.forEach(assertAllowedPermission);
    manifest.hooks.forEach(hook => assertAllowedHook(hook.name));
    this.settings = new ScopedPluginSettings(manifest.id, storage);
  }

  createDocument(ast: PluginLineMlNode): PluginDocument {
    const elementsById = new Map<string, PluginElement>();
    const pageInstanceId = `plugin-page-${nextPageInstanceId++}`;

    const build = (node: PluginLineMlNode): PluginElement => {
      const element = new PluginElement({
        tagName: node.type,
        attributes: {
          ...node.attributes,
          'data-plugin-id': this.manifest.id,
        },
        textContent: node.text,
        pluginId: this.manifest.id,
        pageInstanceId,
      });

      if (element.id) {
        elementsById.set(element.id, element);
      }

      node.children.forEach(child => element.appendChild(build(child)));
      return element;
    };

    return new PluginDocument({
      root: build(ast),
      pageInstanceId,
      elementsById,
    });
  }

  async runPageScript(
    document: PluginDocument,
    setup: (ctx: PluginScriptContext) => unknown | Promise<unknown>,
    overrides?: { toast?: PluginToastApi },
  ): Promise<void> {
    await setup(this.createScriptContext(document, overrides));
  }

  runHookScript(setup: (ctx: PluginScriptContext) => unknown | Promise<unknown>): void {
    const emptyDocument = this.createDocument({ type: 'Page', attributes: {}, children: [] });
    setup(this.createScriptContext(emptyDocument));
  }

  async invokeHook<TEvent extends Record<string, unknown>, TResult>(
    name: string,
    event: TEvent,
    original: (event: TEvent) => Promise<TResult>,
  ): Promise<TResult> {
    return this.hookHandlers.invoke(name, event, original);
  }

  createScriptContext(document: PluginDocument, options?: CreateScriptContextOptions): PluginScriptContext {
    return {
      pluginId: this.manifest.id,
      document,
      settings: this.settings,
      toast: options?.toast ?? { show: async () => undefined },
      hooks: {
        on: (name, handler) => {
          this.assertHookPermission(name);
          const unregister = options?.hostHooks
            ? options.hostHooks.register(name, handler)
            : this.hookHandlers.register(name, handler);
          options?.onDispose?.(unregister);
        },
      },
    };
  }

  private assertHookPermission(name: string): void {
    const permission = `hook.${name}.around`;
    if (!this.manifest.permissions.includes(permission)) {
      throw new Error(`Missing plugin permission: ${permission}`);
    }
  }
}

export function createPluginRuntime(input: { manifest: PluginManifest; storage?: PluginKeyValueStorage }): PluginRuntime {
  return new PluginRuntime(input.manifest, input.storage);
}

type SpacingToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type TextVariantToken = 'title' | 'subtitle' | 'body' | 'caption' | 'code';
type ColorToken = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted';
type ButtonVariantToken = 'primary' | 'secondary' | 'ghost' | 'danger';

function getSpacingToken(value?: string): number | undefined {
  if (!value) return undefined;
  if (value === 'none') return 0;
  return spacing[value as Exclude<SpacingToken, 'none'>];
}

function getElementTestId(element: PluginElement): string | undefined {
  return element.id ? `plugin-element-${element.id}` : undefined;
}

function getTextVariantStyle(variant?: string) {
  switch (variant as TextVariantToken | undefined) {
    case 'title':
      return { fontSize: fontSizes.xl, fontWeight: '700' as const };
    case 'subtitle':
      return { fontSize: fontSizes.lg, fontWeight: '600' as const };
    case 'caption':
      return { fontSize: fontSizes.sm };
    case 'code':
      return { fontSize: fontSizes.sm, fontFamily: 'monospace' };
    case 'body':
    default:
      return { fontSize: fontSizes.md };
  }
}

function getColorToken(colors: ReturnType<typeof useTheme>['colors'], token?: string): string {
  switch (token as ColorToken | undefined) {
    case 'primary':
      return colors.accent;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'muted':
      return colors.textTertiary;
    case 'secondary':
      return colors.textSecondary;
    default:
      return colors.text;
  }
}

function getButtonColors(colors: ReturnType<typeof useTheme>['colors'], variant?: string) {
  switch (variant as ButtonVariantToken | undefined) {
    case 'danger':
      return { backgroundColor: colors.danger, color: '#ffffff', borderColor: colors.danger };
    case 'secondary':
      return { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight };
    case 'ghost':
      return { backgroundColor: 'transparent', color: colors.accent, borderColor: colors.borderLight };
    case 'primary':
    default:
      return { backgroundColor: colors.accent, color: '#ffffff', borderColor: colors.accent };
  }
}

function getElementText(element: PluginElement): string {
  if (typeof element.value === 'string') return element.value;
  return element.textContent;
}

interface LineMLRendererProps {
  document: PluginDocument;
  onRuntimeError?: (error: unknown) => void;
}

export type PluginSetupFunction = (ctx: PluginScriptContext) => unknown | Promise<unknown>;

export interface ActivatePluginOptions {
  manifest: PluginManifest;
  scripts?: Record<string, PluginSetupFunction>;
  views?: Record<string, string>;
  storage?: PluginKeyValueStorage;
  hostHooks?: HostHookManager;
}

export interface ActivatedPluginPage {
  id: string;
  document: PluginDocument;
}

export interface CreatePluginPageOptions {
  toast?: PluginToastApi;
}

export interface ActivatedPlugin {
  manifest: PluginManifest;
  runtime: PluginRuntime;
  createPage(pageId: string, options?: CreatePluginPageOptions): Promise<ActivatedPluginPage>;
  dispose(): void;
}

export async function activatePlugin(options: ActivatePluginOptions): Promise<ActivatedPlugin> {
  const runtime = new PluginRuntime(options.manifest, options.storage);
  const disposers: Array<() => void> = [];
  const hostHooks = options.hostHooks;

  for (const hook of options.manifest.hooks) {
    const setup = options.scripts?.[hook.script];
    if (!setup) {
      throw new Error(`Missing plugin hook script: ${hook.script}`);
    }

    const disposableContext = runtime.createScriptContext(runtime.createDocument({ type: 'Page', attributes: {}, children: [] }), {
      hostHooks,
      onDispose: disposer => disposers.push(disposer),
    });
    await setup(disposableContext);
  }

  return {
    manifest: options.manifest,
    runtime,
    async createPage(pageId: string, pageOptions?: CreatePluginPageOptions): Promise<ActivatedPluginPage> {
      const page = options.manifest.pages.find(item => item.id === pageId);
      if (!page) {
        throw new Error(`Unknown plugin page: ${pageId}`);
      }

      const viewSource = options.views?.[page.view];
      if (!viewSource) {
        throw new Error(`Missing plugin page view: ${page.view}`);
      }

      const setup = options.scripts?.[page.script];
      if (!setup) {
        throw new Error(`Missing plugin page script: ${page.script}`);
      }

      const document = runtime.createDocument(parsePluginLineMl(viewSource));
      await runtime.runPageScript(document, setup, { toast: pageOptions?.toast });
      return { id: page.id, document };
    },
    dispose(): void {
      while (disposers.length > 0) {
        disposers.pop()?.();
      }
    },
  };
}

export function LineMLRenderer({ document, onRuntimeError }: LineMLRendererProps) {
  const { colors } = useTheme();
  const [, forceVersion] = useState(0);
  const refresh = useCallback(() => forceVersion(version => version + 1), []);

  const handleRuntimeError = useCallback((error: unknown) => {
    if (onRuntimeError) {
      onRuntimeError(error);
      return;
    }
    console.warn('[LineMLRenderer] plugin event failed:', error);
  }, [onRuntimeError]);

  const dispatchElementEvents = useCallback(async (element: PluginElement, eventTypes: string[]) => {
    try {
      for (const eventType of eventTypes) {
        await element.dispatchEvent(eventType);
      }
    } catch (error) {
      handleRuntimeError(error);
    } finally {
      refresh();
    }
  }, [handleRuntimeError, refresh]);

  const renderElement = useCallback((element: PluginElement, index = 0): React.ReactNode => {
    if (element.hidden) {
      return null;
    }

    const key = element.id ?? `${element.tagName}-${index}`;
    const testID = getElementTestId(element);
    const disabled = element.disabled;

    switch (element.tagName) {
      case 'Page':
        return (
          <View key={key} testID={testID} style={[rendererStyles.page, { backgroundColor: colors.bg }]}>
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </View>
        );
      case 'Scroll':
        return (
          <ScrollView key={key} testID={testID} style={rendererStyles.flex}>
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </ScrollView>
        );
      case 'Stack':
        return (
          <View
            key={key}
            testID={testID}
            style={[
              rendererStyles.stack,
              {
                padding: getSpacingToken(element.getAttribute('padding')),
                gap: getSpacingToken(element.getAttribute('spacing')),
              },
            ]}
          >
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </View>
        );
      case 'Row':
        return (
          <View
            key={key}
            testID={testID}
            style={[
              rendererStyles.row,
              {
                padding: getSpacingToken(element.getAttribute('padding')),
                gap: getSpacingToken(element.getAttribute('gap')),
              },
            ]}
          >
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </View>
        );
      case 'Text':
        return (
          <View key={key} testID={testID}>
            <Text
              style={[
                rendererStyles.text,
                getTextVariantStyle(element.getAttribute('variant')),
                { color: getColorToken(colors, element.getAttribute('color')) },
              ]}
            >
              {getElementText(element)}
            </Text>
          </View>
        );
      case 'Markdown':
        return (
          <View key={key} testID={testID}>
            <Markdown>{getElementText(element) || element.getAttribute('content') || ''}</Markdown>
          </View>
        );
      case 'CodeBlock':
        return (
          <View key={key} testID={testID} style={[rendererStyles.codeBlock, { backgroundColor: colors.codeBg }]}>
            <Text style={[rendererStyles.codeText, { color: colors.text }]}>{getElementText(element)}</Text>
          </View>
        );
      case 'Button': {
        const buttonColors = getButtonColors(colors, element.getAttribute('variant'));
        return (
          <View key={key} testID={testID}>
            <Pressable
              testID={element.id ? `plugin-element-${element.id}-button` : undefined}
              disabled={disabled}
              onPress={() => dispatchElementEvents(element, ['click'])}
              style={[
                rendererStyles.button,
                disabled && rendererStyles.disabled,
                { backgroundColor: buttonColors.backgroundColor, borderColor: buttonColors.borderColor },
              ]}
            >
              <Text style={[rendererStyles.buttonText, { color: buttonColors.color }]}>{getElementText(element)}</Text>
            </Pressable>
          </View>
        );
      }
      case 'Input':
      case 'TextArea': {
        const multiline = element.tagName === 'TextArea';
        return (
          <View key={key} testID={testID} style={rendererStyles.field}>
            {!!element.getAttribute('label') && (
              <Text style={[rendererStyles.label, { color: colors.textSecondary }]}>{element.getAttribute('label')}</Text>
            )}
            <TextInput
              editable={!disabled}
              multiline={multiline}
              placeholder={element.getAttribute('placeholder')}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={element.getAttribute('secure') === 'true'}
              value={typeof element.value === 'string' ? element.value : ''}
              onChangeText={value => {
                element.value = value;
                refresh();
                return dispatchElementEvents(element, ['input', 'change']);
              }}
              style={[
                rendererStyles.input,
                multiline && rendererStyles.textArea,
                { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight, color: colors.text },
              ]}
            />
          </View>
        );
      }
      case 'Switch':
        return (
          <View key={key} testID={testID} style={[rendererStyles.switchRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[rendererStyles.label, { color: colors.text }]}>{element.getAttribute('label') ?? ''}</Text>
            <Pressable
              testID={element.id ? `plugin-element-${element.id}-toggle` : undefined}
              disabled={disabled}
              onPress={() => {
                element.checked = !element.checked;
                refresh();
                return dispatchElementEvents(element, ['click', 'change']);
              }}
              style={[
                rendererStyles.switchTrack,
                disabled && rendererStyles.disabled,
                { backgroundColor: element.checked ? colors.accent : colors.surfaceLight },
              ]}
            >
              <View style={[rendererStyles.switchThumb, element.checked && rendererStyles.switchThumbChecked]} />
            </Pressable>
          </View>
        );
      case 'Card':
        return (
          <View
            key={key}
            testID={testID}
            style={[rendererStyles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}
          >
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </View>
        );
      case 'Section':
        return (
          <View key={key} testID={testID} style={rendererStyles.section}>
            {!!element.getAttribute('title') && (
              <Text style={[rendererStyles.sectionTitle, { color: colors.textSecondary }]}>{element.getAttribute('title')}</Text>
            )}
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </View>
        );
      case 'Divider':
        return <View key={key} testID={testID} style={[rendererStyles.divider, { backgroundColor: colors.borderLight }]} />;
      case 'Spacer':
        return <View key={key} testID={testID} style={{ height: getSpacingToken(element.getAttribute('size')) ?? spacing.md }} />;
      case 'Select':
      case 'Option':
      default:
        return (
          <View key={key} testID={testID}>
            {element.children.map((child, childIndex) => renderElement(child, childIndex))}
          </View>
        );
    }
  }, [colors, dispatchElementEvents, refresh]);

  return <React.Fragment>{renderElement(document.root)}</React.Fragment>;
}

const rendererStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  stack: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  switchThumbChecked: {
    transform: [{ translateX: 18 }],
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  codeBlock: {
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  codeText: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
});
