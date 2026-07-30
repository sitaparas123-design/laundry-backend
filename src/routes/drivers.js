const express = require('express');
const Driver = require('../models/Driver');
const Branch = require('../models/Branch');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

const formatDriver = (driver) => {
  return {
    id: driver._id.toString(),
    userId: driver.user ? driver.user.toString() : '',
    driverNo: driver.driverNo,
    driverName: driver.driverName,
    mobile: driver.mobile,
    tel: driver.tel || '',
    areas: driver.areas || [],
    street: driver.street || '',
    part: driver.part || '',
    jadda: driver.jadda || '',
    houseNo: driver.houseNo || '',
    floor: driver.floor || '',
    flat: driver.flat || '',
    addressNotes: driver.addressNotes || '',
    carNo: driver.carNo,
    civilId: driver.civilId,
    nationality: driver.nationality,
    branch: driver.branch,
    status: driver.status
  };
};

// @route   GET /api/drivers
// @desc    Get all drivers
router.get('/', authenticate, async (req, res) => {
  try {
    const activeBranches = await Branch.find().select('name');
    const existingBranchNames = activeBranches.map(b => b.name);

    let query = {};
    if (req.user.branch && !req.isHomeServiceBranch) {
      const branchObj = await Branch.findById(req.user.branch);
      if (branchObj) {
        query = { branch: branchObj.name };
      } else {
        query = { branch: 'NON_EXISTENT_BRANCH_TO_PREVENT_LEAK' };
      }
    } else {
      query = { branch: { $in: existingBranchNames } };
    }
    const drivers = await Driver.find(query).sort({ createdAt: -1 });
    res.json(drivers.map(formatDriver));
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/drivers
// @desc    Create a driver
router.post('/', authenticate, requirePermission('manage_staff'), async (req, res) => {
  try {
    const {
      userId, driverNo, driverName, mobile, tel, areas,
      street, part, jadda, houseNo, floor, flat, addressNotes,
      carNo, civilId, nationality, branch, status
    } = req.body;

    let finalDriverNo = driverNo;
    if (!finalDriverNo) {
      const allDrivers = await Driver.find({});
      let maxNum = 100;
      for (const d of allDrivers) {
        if (d.driverNo) {
          const match = d.driverNo.match(/DRV-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
      let nextNum = maxNum + 1;
      let unique = false;
      while (!unique) {
        finalDriverNo = `DRV-${nextNum}`;
        const conflict = await Driver.findOne({ driverNo: finalDriverNo });
        if (!conflict) {
          unique = true;
        } else {
          nextNum++;
        }
      }
    }

    if (!finalDriverNo || !driverName || !mobile || !carNo || !civilId || !nationality || !branch) {
      return res.status(400).json({ message: 'Missing required driver profile fields.' });
    }

    const existingDriver = await Driver.findOne({ driverNo: finalDriverNo });
    if (existingDriver) {
      return res.status(400).json({ message: 'A driver with this driver number already exists.' });
    }

    const driver = new Driver({
      user: userId,
      driverNo: finalDriverNo,
      driverName,
      mobile,
      tel,
      areas: areas || [],
      street,
      part,
      jadda,
      houseNo,
      floor,
      flat,
      addressNotes,
      carNo,
      civilId,
      nationality,
      branch,
      status: status || 'Available'
    });

    await driver.save();
    res.status(201).json(formatDriver(driver));
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   PUT /api/drivers/:id
// @desc    Update a driver
router.put('/:id', authenticate, requirePermission('manage_staff'), async (req, res) => {
  try {
    const {
      driverNo, driverName, mobile, tel, areas,
      street, part, jadda, houseNo, floor, flat, addressNotes,
      carNo, civilId, nationality, branch, status
    } = req.body;

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    if (driverNo) driver.driverNo = driverNo;
    if (driverName) driver.driverName = driverName;
    if (mobile) driver.mobile = mobile;
    if (tel !== undefined) driver.tel = tel;
    if (areas) driver.areas = areas;
    if (street !== undefined) driver.street = street;
    if (part !== undefined) driver.part = part;
    if (jadda !== undefined) driver.jadda = jadda;
    if (houseNo !== undefined) driver.houseNo = houseNo;
    if (floor !== undefined) driver.floor = floor;
    if (flat !== undefined) driver.flat = flat;
    if (addressNotes !== undefined) driver.addressNotes = addressNotes;
    if (carNo) driver.carNo = carNo;
    if (civilId) driver.civilId = civilId;
    if (nationality) driver.nationality = nationality;
    if (branch) driver.branch = branch;
    if (status) driver.status = status;

    await driver.save();
    res.json(formatDriver(driver));
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   DELETE /api/drivers/:id
// @desc    Delete driver profile
router.delete('/:id', authenticate, requirePermission('manage_staff'), async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    await Driver.deleteOne({ _id: driver._id });
    res.json({ message: 'Driver profile deleted successfully.' });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
