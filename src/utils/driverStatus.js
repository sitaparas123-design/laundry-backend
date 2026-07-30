const Pickup = require('../models/Pickup');
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');

const updateDriverStatus = async (driverName) => {
  if (!driverName) return;

  try {
    const driver = await Driver.findOne({ driverName });
    if (!driver) return;

    // If driver explicitly set to 'Off Duty', let them remain Off Duty unless we want the system to override it.
    // Let's assume if they have active jobs, they must be on duty.
    const pickups = await Pickup.find({ 
      assignedStaff: driverName, 
      status: { $in: ['Assigned', 'Picked Up', 'In Progress'] } 
    });
    
    const deliveries = await Delivery.find({ 
      assignedStaff: driverName, 
      status: { $in: ['Assigned', 'Out for Delivery'] } 
    });

    let hasAssigned = false;
    let hasActive = false;

    for (const p of pickups) {
      if (p.status === 'Assigned') hasAssigned = true;
      if (p.status === 'Picked Up' || p.status === 'In Progress') hasActive = true;
    }

    for (const d of deliveries) {
      if (d.status === 'Assigned') hasAssigned = true;
      if (d.status === 'Out for Delivery') hasActive = true;
    }

    let newStatus = 'Available';
    
    if (hasActive) {
      newStatus = 'On Delivery';
    } else if (hasAssigned) {
      newStatus = 'Assigned';
    } else {
      if (driver.status === 'Off Duty') {
        newStatus = 'Off Duty';
      } else {
        newStatus = 'Available';
      }
    }

    if (driver.status !== newStatus) {
      driver.status = newStatus;
      await driver.save();
    }
  } catch (error) {
    console.error(`Error updating driver status for ${driverName}:`, error);
  }
};

module.exports = { updateDriverStatus };
