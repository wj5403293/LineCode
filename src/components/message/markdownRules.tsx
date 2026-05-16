import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ASTNode, RenderRules } from 'react-native-markdown-display';
import CodeBlock from '../CodeBlock';

type LatexFormulaComponent = React.ComponentType<{
  math: string;
  color: string;
  display?: boolean;
}>;

interface CreateMessageMarkdownRulesOptions {
  codeWrap?: boolean;
  mathFormulaRenderingEnabled?: boolean;
}

function hasLatexChild(node: ASTNode): boolean {
  if (node.type === 'latex_inline' || node.type === 'latex_block') return true;
  return node.children?.some(hasLatexChild) || false;
}

function splitChildrenByLatex(children: React.ReactNode[]): React.ReactNode[] {
  const LatexFormula = getLatexFormula();
  const groups: React.ReactNode[] = [];
  let inlineChildren: React.ReactNode[] = [];

  const flushInline = (key: string) => {
    if (inlineChildren.length === 0) return;
    groups.push(
      <Text key={key} selectable>
        {inlineChildren}
      </Text>
    );
    inlineChildren = [];
  };

  children.forEach((child, index) => {
    if (React.isValidElement(child) && child.type === LatexFormula) {
      flushInline(`text-${index}`);
      groups.push(child);
      return;
    }
    inlineChildren.push(child);
  });

  flushInline('text-end');
  return groups;
}

function textColor(styles: any, inheritedStyles = {}): string {
  const flattened = StyleSheet.flatten([
    styles.body,
    styles.text,
    inheritedStyles,
  ]) as { color?: unknown } | undefined;

  return typeof flattened?.color === 'string' ? flattened.color : '#FFFFFF';
}

function getLatexFormula(): LatexFormulaComponent {
  return require('./LatexFormula').default as LatexFormulaComponent;
}

export function createMessageMarkdownRules({
  codeWrap,
  mathFormulaRenderingEnabled,
}: CreateMessageMarkdownRulesOptions = {}): RenderRules {
  const rules: RenderRules = {
    text: (node, _children, _parent, styles, inheritedStyles = {}) => (
      <Text key={node.key} selectable style={[inheritedStyles, styles.text]}>
        {node.content}
      </Text>
    ),
    textgroup: (node, children, _parent, styles) => (
      mathFormulaRenderingEnabled && hasLatexChild(node) ? (
        <View key={node.key} style={styles.latex_textgroup}>
          {splitChildrenByLatex(children)}
        </View>
      ) : (
        <Text key={node.key} selectable style={styles.textgroup}>
          {children}
        </Text>
      )
    ),
    strong: (node, children, _parent, styles) => (
      mathFormulaRenderingEnabled && hasLatexChild(node) ? (
        <View key={node.key} style={styles.latex_textgroup}>
          {splitChildrenByLatex(children)}
        </View>
      ) : (
        <Text key={node.key} selectable style={styles.strong}>
          {children}
        </Text>
      )
    ),
    em: (node, children, _parent, styles) => (
      mathFormulaRenderingEnabled && hasLatexChild(node) ? (
        <View key={node.key} style={styles.latex_textgroup}>
          {splitChildrenByLatex(children)}
        </View>
      ) : (
        <Text key={node.key} selectable style={styles.em}>
          {children}
        </Text>
      )
    ),
    code_inline: (node, _children, _parent, styles, inheritedStyles = {}) => (
      <Text key={node.key} selectable style={[inheritedStyles, styles.code_inline]}>
        {node.content}
      </Text>
    ),
    fence: node => {
      const language = node.attributes?.language || '';
      const code = node.content || '';
      return <CodeBlock key={node.key} language={language} code={code} wordWrap={codeWrap} />;
    },
    code_block: node => {
      const code = node.content || '';
      return <CodeBlock key={node.key} code={code} wordWrap={codeWrap} />;
    },
  };

  if (!mathFormulaRenderingEnabled) {
    return rules;
  }

  const LatexFormula = getLatexFormula();

  return {
    ...rules,
    latex_inline: (node, _children, _parent, styles, inheritedStyles = {}) => (
      <LatexFormula
        key={node.key}
        math={node.content || ''}
        color={textColor(styles, inheritedStyles)}
      />
    ),
    latex_block: (node, _children, _parent, styles) => (
      <View key={node.key} style={styles.latex_block}>
        <LatexFormula
          math={node.content || ''}
          color={textColor(styles)}
          display
        />
      </View>
    ),
  };
}
