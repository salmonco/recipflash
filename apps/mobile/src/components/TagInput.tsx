import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, typography } from '../styles/theme';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [currentInput, setCurrentInput] = useState('');
  const [tags, setTags] = useState<string[]>(value);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTags(value);
  }, [value]);

  const handleTextChange = (text: string) => {
    // If the last character is a space, create a tag
    if (text.endsWith(' ') && text.trim().length > 0) {
      const newTag = text.trim();
      if (!tags.includes(newTag)) {
        const updatedTags = [...tags, newTag];
        setTags(updatedTags);
        onChange(updatedTags);
      }
      setCurrentInput('');
    } else {
      setCurrentInput(text);
    }
  };

  const handleKeyPress = ({ nativeEvent }: any) => {
    // If backspace is pressed and input is empty, remove last tag
    if (
      nativeEvent.key === 'Backspace' &&
      currentInput === '' &&
      tags.length > 0
    ) {
      const updatedTags = tags.slice(0, -1);
      setTags(updatedTags);
      onChange(updatedTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    onChange(updatedTags);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
            <Pressable
              onPress={() => removeTag(tag)}
              style={styles.removeButton}
            >
              <Icon name="close" size={16} color={colors.white} />
            </Pressable>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          value={currentInput}
          onChangeText={handleTextChange}
          onKeyPress={handleKeyPress}
          placeholderTextColor={colors.gray}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 15,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 50,
    borderColor: colors.gray,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 5,
  },
  tagText: {
    ...typography.body,
    color: colors.white,
    marginRight: 5,
  },
  removeButton: {
    marginLeft: 2,
  },
  input: {
    ...typography.body,
    flex: 1,
    minWidth: 80,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 5,
    color: colors.text,
  },
});

export default TagInput;
