import React, { useState } from 'react';
import {
  Select,
  Box,
  Text,
  VStack,
  HStack,
  Badge,
} from '@chakra-ui/react';

const PrayerHistory = ({ prayers }) => {
  const [filterDays, setFilterDays] = useState('7');

  const filterPrayers = () => {
    const today = new Date();
    const filterDate = new Date(today.setDate(today.getDate() - parseInt(filterDays)));
    
    return prayers.filter(prayer => {
      const prayerDate = new Date(prayer.timestamp);
      return prayerDate >= filterDate;
    });
  };

  return (
    <Box mt={6}>
      <HStack mb={4}>
        <Text fontWeight="bold">Prayer History</Text>
        <Select 
          value={filterDays} 
          onChange={(e) => setFilterDays(e.target.value)}
          width="150px"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </HStack>

      <VStack spacing={3} align="stretch">
        {filterPrayers().map((prayer, index) => (
          <Box 
            key={index}
            p={3}
            borderWidth="1px"
            borderRadius="md"
            backgroundColor="white"
          >
            <HStack justify="space-between">
              <Text>{prayer.content}</Text>
              <Badge colorScheme={prayer.answered ? 'green' : 'gray'}>
                {prayer.answered ? 'Answered' : 'Ongoing'}
              </Badge>
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {new Date(prayer.timestamp).toLocaleDateString()}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

export default PrayerHistory; 