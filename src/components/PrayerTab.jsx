import React, { useState, useEffect } from 'react';
import {
  Box,
  Input,
  Button,
  VStack,
  HStack,
  Text,
  useToast,
  Badge,
} from '@chakra-ui/react';
import PrayerHistory from './PrayerHistory';

function PrayerTab() {
  const [prayers, setPrayers] = useState([]);
  const [newPrayer, setNewPrayer] = useState('');
  const toast = useToast();

  // Load prayers from localStorage on component mount
  useEffect(() => {
    const savedPrayers = localStorage.getItem('prayers');
    if (savedPrayers) {
      setPrayers(JSON.parse(savedPrayers));
    }
  }, []);

  // Save prayers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('prayers', JSON.stringify(prayers));
  }, [prayers]);

  const addPrayer = () => {
    if (!newPrayer.trim()) {
      toast({
        title: 'Please enter a prayer',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const prayer = {
      id: Date.now(),
      content: newPrayer,
      answered: false,
      timestamp: new Date().toISOString(),
    };
    setPrayers([...prayers, prayer]);
    setNewPrayer('');

    toast({
      title: 'Prayer added',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const toggleAnswered = (id) => {
    setPrayers(prayers.map(prayer => 
      prayer.id === id ? { ...prayer, answered: !prayer.answered } : prayer
    ));
  };

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        {/* Prayer Input */}
        <Box>
          <HStack>
            <Input
              value={newPrayer}
              onChange={(e) => setNewPrayer(e.target.value)}
              placeholder="Enter your prayer..."
              onKeyPress={(e) => e.key === 'Enter' && addPrayer()}
            />
            <Button colorScheme="teal" onClick={addPrayer}>
              Add Prayer
            </Button>
          </HStack>
        </Box>

        {/* Current Prayers List */}
        <VStack spacing={3} align="stretch">
          {prayers.length === 0 ? (
            <Text color="gray.500" textAlign="center">No prayers added yet</Text>
          ) : (
            prayers.map((prayer) => (
              <Box
                key={prayer.id}
                p={3}
                borderWidth="1px"
                borderRadius="md"
                onClick={() => toggleAnswered(prayer.id)}
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
              >
                <HStack justify="space-between">
                  <Text>{prayer.content}</Text>
                  <Badge colorScheme={prayer.answered ? 'green' : 'gray'}>
                    {prayer.answered ? 'Answered' : 'Ongoing'}
                  </Badge>
                </HStack>
              </Box>
            ))
          )}
        </VStack>

        {/* Prayer History */}
        <PrayerHistory prayers={prayers} />
      </VStack>
    </Box>
  );
}

export default PrayerTab; 