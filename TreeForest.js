import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const MAX_TREES = 30;
const COLS = 6;
const ROWS = Math.ceil(MAX_TREES / COLS);
const CELL_SIZE = 40;

const TreeForest = ({ trees = [] }) => {
  const limitedTrees = trees.slice(0, MAX_TREES);

  return (
    <View>
      <View style={styles.forestBox}>
        <View style={styles.forestInner}>
          {limitedTrees.map((tree, index) => {
            const col = index % COLS;
            const row = Math.floor(index / COLS);
            const left = col * CELL_SIZE;
            const top = row * CELL_SIZE;

            return (
              <View
                key={tree.id ?? index}
                style={[styles.treeWrapper, { left, top }]}
              >
                <Text style={styles.treeEmoji}>
                  {tree.emoji || '🌳'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.caption}>
        심은 나무: {limitedTrees.length}그루
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  forestBox: {
    width: '100%',
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forestInner: {
    width: COLS * CELL_SIZE,
    height: ROWS * CELL_SIZE,
    position: 'relative',
  },
  treeWrapper: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  treeEmoji: {
    fontSize: 20,
  },
  caption: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 12,
  },
});

export default TreeForest;